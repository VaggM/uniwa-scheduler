import requests
import re
import json
from bs4 import BeautifulSoup

def get_uniwa_classrooms():

    # /list/:interger is needed to retrieve the page
    url = "http://classschedule.uniwa.gr/areas/list/30"

    res = requests.get(url)

    # add check for https later
    if not res.status_code == 200:
        raise Exception(f"Connection error: {res.status_code}")

    soup = BeautifulSoup(res.text, 'html.parser')

    tb_rows = soup.select('tr[data-area]')

    print(f"Found {len(tb_rows)} classrooms")

    classrooms = []

    # example (len == 4): "Αρχαίος Ελαιώνας.Δ.Πρώτος.108"
    # example (len == 5): "Αρχαίος Ελαιώνας.ΣΑ.Ισόγειο.1.Συνεδριακό κέντρο/Κεντρικό αμφιθέατρο"
    for row in tb_rows:

        id = row.select_one("span#classroom_title a").get("href").split("/")[-1]
        period_code = row.select_one("span#classroom_title a").get("href").split("/")[-2]

        split_data = row.get("data-area").split(".")

        if len(split_data) not in [4, 5]:
            print(f"Error in format: {row.get("data-area")}")
            continue
        
        classroom = {
            "id": id,
            "campus": split_data[0],
            "building": split_data[1],
            "floor": split_data[2],
            "code": split_data[3],
        }

        if classroom["floor"] != "Ισόγειο":
            classroom["floor"] += " όροφος"

        if len(split_data) == 5:
            classroom["code"] = ".".join(split_data[3:5])

        classrooms.append(classroom)

    # for room in classrooms:
    #     print(f"{room["building"]}.{room["code"]}: {room["id"]}")
    return classrooms, period_code


def get_period_ids(classroom, init_period_code):

    url = f"http://classschedule.uniwa.gr/areas/{init_period_code}/{classroom['id']}"

    res = requests.get(url)

    if res.status_code != 200:
        raise Exception(f"Error fetching classroom data: {classroom['id']}")

    soup = BeautifulSoup(res.text, "html.parser")

    periods = []
    period_options = soup.select("select#academic_periods option")

    for period in period_options:
        # if "Εξεταστική" not in period.text:
        periods.append({"id": period.get("value"), "name": period.text})
    
    return periods


def get_departments(classrooms, periods):

    departments = {}

    for period in periods:
        period_id = period["id"]
        exam_period = "Εξεταστική" in period["name"]
        print(period["name"])
        for classroom in classrooms:
        
            url = f"http://classschedule.uniwa.gr/areas/{period_id}/{classroom['id']}"

            res = requests.get(url)

            if res.status_code != 200:
                print(f"Error fetching classroom data: {classroom['id']}")
                continue

            soup = BeautifulSoup(res.text, "html.parser")
            script_events = soup.find('script', string=re.compile("events"))

            match = re.search(r'\[.*\]', script_events.text)

            if not match:
                print(f"Matching error on classroom: {classroom["id"]}")
                continue

            json_string = match.group(0)
            data = json.loads(json_string) # Converts string to Python Dict

            for entry in data:

                dep = entry["department_name"]
                period = entry["academic_period_name"]
                day = entry["day_of_week"]
                time_start = entry["starting_hour"][:-3]
                time_end = entry["ending_hour"][:-3]
                course = entry["event_data"]["course_name"]
                professor = entry["event_data"]["professor"]
                area_id = entry["area_id"]
                date = entry["startRecur"].split(" ")[0]

                # skip event entries -> no recurrence
                if not exam_period and entry["academic_period_valid_to"] != entry["endRecur"]:
                    continue

                if dep not in departments.keys():
                    departments[dep] = {}
                
                if period not in departments[dep].keys():
                    if not exam_period:
                        departments[dep][period] = []
                    else:
                        departments[dep][period] = {}

                # fix course wrong "και"
                for word in ['&amp;amp;amp;', '&amp;amp;', '&amp;', 'amp;']:
                    if word in course:
                        course = course.replace(word, "KAI")
                
                print(f"Added: {course}")

                if not exam_period:
                    departments[dep][period].append({
                        "day": day,
                        "time_start": time_start,
                        "time_end": time_end,
                        "course": course,
                        "professor": professor,
                        "area_id": area_id
                    })
                else:
                    if course not in departments[dep][period].keys():
                        departments[dep][period][course] = {
                            "date": date,
                            "time_start": time_start,
                            "time_end": time_end,
                            # "professor": professor,
                            "area_id": [area_id]
                        }
                    else:
                        departments[dep][period][course]["area_id"].append(area_id)

    return departments


classrooms, init_period_id = get_uniwa_classrooms()
periods = get_period_ids(classrooms[0], init_period_id)
departments = get_departments(classrooms, periods)

for dep_name, dep_value in departments.items():
    print(dep_name)
    for period in dep_value.keys():
        print(f"\t{len(dep_value[period])}: {period}")

data = {
    "period_names": [period["name"] for period in periods],
    "classrooms": classrooms,
    "departments": departments
}

with open("web/scripts/data.js", "w", encoding="utf-8") as f:
    f.write("const appData = ")
    json.dump(data, f, indent=4) # ensure_ascii=False)
    f.write(";")
