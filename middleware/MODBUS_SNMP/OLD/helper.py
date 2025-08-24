import sys
from typing import Any
import dotenv
import requests
import getmac
import os
import json

from requests.api import head


def get_devices_list() -> Any:
    devices_mode = dotenv.dotenv_values()['DEVICES_MODE']

    if devices_mode == 'DYNAMIC':
        github_token = dotenv.dotenv_values()['GITHUB_PERSONAL_ACCESS_TOKEN']
        github_devices_url = dotenv.dotenv_values()['DEVICES_URL']

        res = requests.get(url=github_devices_url, headers={
                           'authorization': f'token {github_token}'})

        if res.status_code is not 200:
            print('[Get devices error] not ok')
        else:
            devices_json_file = open(
                os.getcwd() + '/JSON/Config/Library/devices.json', 'w+')
            devices_json_file.write(res.text)
            devices_json_file.close()

    with open(os.getcwd() + '/JSON/Config/Library/devices.json') as json_data:
        return json.load(json_data)
