import os
import json

JSON_FILE_PATH = os.path.join(os.path.dirname(__file__), "../data/settings.json")

DEFAULT_SETTINGS = {
    "emailNotif": True,
    "slackNotif": False,
    "aiFailAlert": True,
    "weeklyReport": True,
    "autoEscalate": True,
    "hallucinationDetect": True,
    "autoFAQ": False,
    "compactView": False,
    "language": "vi",
    "exportFormat": "xlsx",
    "dataRetention": "90",
    "showAiFailed": True,
    "sortBy": "newest",
    "pageSize": "20",
    "channelZaloOA": True,
    "channelZaloBiz": False,
    "channelFacebook": True,
    "channelWidget": False,
    "alertFailRate": 15,
    "alertResponseTime": 30,
    "alertUncertainRate": 25,
    "dataSourceZalo": True,
    "dataSourceFb": True,
    "dataSourceWidget": True,
    "dataSyncInterval": "5",
}


class SettingsRepository:
    def get_settings(self) -> dict:
        try:
            if not os.path.exists(JSON_FILE_PATH):
                return DEFAULT_SETTINGS.copy()
            with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content:
                    return DEFAULT_SETTINGS.copy()
                data = json.loads(content)
                # Ensure all default keys exist
                merged = DEFAULT_SETTINGS.copy()
                merged.update(data)
                return merged
        except Exception as e:
            print("Lỗi khi đọc file settings.json:", e)
            return DEFAULT_SETTINGS.copy()

    def save_settings(self, settings: dict) -> None:
        try:
            dir_name = os.path.dirname(JSON_FILE_PATH)
            if not os.path.exists(dir_name):
                os.makedirs(dir_name, exist_ok=True)
            with open(JSON_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print("Lỗi khi ghi file settings.json:", e)
            raise e


settings_repository = SettingsRepository()
