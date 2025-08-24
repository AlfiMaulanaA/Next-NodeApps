# protocols2mqtt

### Running prerequisites

1. Python3.6

2. Create `.env` file

```sh
DEVICES_MODE=DYNAMIC # DYNAMIC or STATIC
GITHUB_PERSONAL_ACCESS_TOKEN= # Your github personal access token
DEVICES_URL= # raw.githubusercontent.com
```

2. (Optional) create a virtual environment

```sh
python3 -m venv .venv/middleware
source .venv/middleware/bin/activate
```

3. Update pip, if using venv

```sh
python3 -m pip install -U pip
```

4. Install dependencies

```sh
python3 -m pip install -r requirements.txt
```

5. Run in sudo

```sh
sudo ./venv/middleware/bin/python3 main.py
```
