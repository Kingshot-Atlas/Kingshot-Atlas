from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")  # user, admin, moderator
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Kingdom(Base):
    __tablename__ = "kingdoms"
    __table_args__ = (
        Index('ix_kingdoms_overall_score', 'overall_score'),
        Index('ix_kingdoms_status', 'most_recent_status'),
        Index('ix_kingdoms_prep_win_rate', 'prep_win_rate'),
        Index('ix_kingdoms_battle_win_rate', 'battle_win_rate'),
    )
    
    kingdom_number = Column(Integer, primary_key=True, index=True)
    total_kvks = Column(Integer, nullable=False)
    prep_wins = Column(Integer, nullable=False)
    prep_losses = Column(Integer, nullable=False)
    prep_win_rate = Column(Float, nullable=False)
    prep_streak = Column(Integer, nullable=False)
    battle_wins = Column(Integer, nullable=False)
    battle_losses = Column(Integer, nullable=False)
    battle_win_rate = Column(Float, nullable=False)
    battle_streak = Column(Integer, nullable=False)
    dominations = Column(Integer, nullable=False, default=0)
    defeats = Column(Integer, nullable=False, default=0)
    most_recent_status = Column(String, nullable=False)
    overall_score = Column(Float, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to KVK records
    kvk_records = relationship("KVKRecord", back_populates="kingdom")

class KVKRecord(Base):
    __tablename__ = "kvk_records"
    __table_args__ = (
        Index('ix_kvk_kingdom_kvknum', 'kingdom_number', 'kvk_number'),
    )
    
    id = Column(Integer, primary_key=True, index=True)
    kingdom_number = Column(Integer, ForeignKey("kingdoms.kingdom_number"), nullable=False, index=True)
    kvk_number = Column(Integer, nullable=False)
    opponent_kingdom = Column(Integer, nullable=False)
    prep_result = Column(String, nullable=False)  # W, L
    battle_result = Column(String, nullable=False)  # W, L
    overall_result = Column(String, nullable=False)  # W, L
    date_or_order_index = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationship to kingdom
    kingdom = relationship("Kingdom", back_populates="kvk_records")


class KVKSubmission(Base):
    """Community-submitted KVK results awaiting moderation"""
    __tablename__ = "kvk_submissions"
    
    id = Column(Integer, primary_key=True, index=True)
    submitter_id = Column(String, nullable=False, index=True)  # Supabase user ID
    submitter_name = Column(String, nullable=True)
    
    # KVK data
    kingdom_number = Column(Integer, nullable=False, index=True)
    kvk_number = Column(Integer, nullable=False)
    opponent_kingdom = Column(Integer, nullable=False)
    prep_result = Column(String, nullable=False)  # W, L
    battle_result = Column(String, nullable=False)  # W, L
    date_or_order_index = Column(String, nullable=True)
    
    # Evidence
    screenshot_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Moderation
    status = Column(String, default="pending", index=True)  # pending, approved, rejected
    reviewed_by = Column(String, nullable=True)
    review_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)


class KingdomClaim(Base):
    """Kingdom manager claims for premium features"""
    __tablename__ = "kingdom_claims"
    
    id = Column(Integer, primary_key=True, index=True)
    kingdom_number = Column(Integer, nullable=False, unique=True, index=True)
    user_id = Column(String, nullable=False, index=True)  # Supabase user ID
    
    # Verification
    status = Column(String, default="pending", index=True)  # pending, verified, rejected
    verification_code = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    
    # Premium features
    is_premium = Column(Boolean, default=False)
    premium_expires_at = Column(DateTime, nullable=True)
    
    # Customization
    custom_banner_url = Column(String, nullable=True)
    custom_description = Column(Text, nullable=True)
    discord_link = Column(String, nullable=True)
    recruitment_status = Column(String, default="closed")  # open, closed, selective
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
