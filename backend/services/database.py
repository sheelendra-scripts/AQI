"""Database models and async engine for AQMS."""
import os
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./aqms.db")

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


class SensorReading(Base):
    """Stores every reading fetched from ThingSpeak."""
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    ward_id = Column(String(50), default="ward_01", index=True)
    temperature = Column(Float)
    humidity = Column(Float)
    pm25 = Column(Float)
    tvoc = Column(Float)
    no2 = Column(Float)
    co = Column(Float)
    aqi = Column(Integer)
    aqi_category = Column(String(20))
    source_detected = Column(String(50), nullable=True)
    source_confidence = Column(Float, nullable=True)
    is_anomaly = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Ward(Base):
    """Ward metadata for multi-sensor deployment."""
    __tablename__ = "wards"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    description = Column(String(255), nullable=True)


class WindReading(Base):
    """Stores wind observations from zone weather stations."""
    __tablename__ = "wind_readings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    station_id = Column(String(50), nullable=False, index=True)
    wind_speed = Column(Float)       # m/s
    wind_direction = Column(Float)   # degrees (0=N, 90=E)
    temperature = Column(Float)
    pressure = Column(Float)
    source = Column(String(20))      # 'openweathermap' or 'simulated'
    created_at = Column(DateTime, default=datetime.utcnow)


class AttributionScore(Base):
    """Stores Bayesian source attribution probabilities per ward."""
    __tablename__ = "attribution_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    ward_id = Column(String(50), nullable=False, index=True)
    vehicular = Column(Float, default=0.0)
    industrial = Column(Float, default=0.0)
    biomass = Column(Float, default=0.0)
    construction = Column(Float, default=0.0)
    dust = Column(Float, default=0.0)
    regional = Column(Float, default=0.0)
    dominant_source = Column(String(30))
    confidence = Column(String(10))  # low/medium/high
    wind_speed = Column(Float)
    wind_direction = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)


async def init_db():
    """Create all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
