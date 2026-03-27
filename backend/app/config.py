from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres123@localhost:5432/attendance_db"
    SECRET_KEY: str = "local-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    FACE_RECOGNITION_TOLERANCE: float = 0.5
    FACE_ENCODING_MODEL: str = "large"
    UPLOAD_DIR: str = "uploads"
    class Config:
        env_file = ".env"
settings = Settings()
