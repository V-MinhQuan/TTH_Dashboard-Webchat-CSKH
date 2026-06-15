from app.settings.repository import settings_repository


class SettingsService:
    def get_settings(self) -> dict:
        return settings_repository.get_settings()

    def update_settings(self, updates: dict) -> dict:
        current = settings_repository.get_settings()
        for k, v in updates.items():
            # Basic validation: only update known keys
            if k in current:
                # Keep matching types if possible
                expected_type = type(current[k])
                if isinstance(v, expected_type):
                    current[k] = v
                elif expected_type is int:
                    try:
                        current[k] = int(v)
                    except (ValueError, TypeError):
                        pass
                elif expected_type is bool:
                    current[k] = bool(v)
                else:
                    current[k] = v
        settings_repository.save_settings(current)
        return current


settings_service = SettingsService()
