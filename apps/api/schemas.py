from pydantic import BaseModel, Field, field_validator, EmailStr
from typing import Optional, List, Generic, TypeVar, Literal
from datetime import datetime
import re

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int

class KingdomBase(BaseModel):
    kingdom_number: int
    total_kvks: int
    prep_wins: int
    prep_losses: int
    prep_win_rate: float
    prep_streak: int
    battle_wins: int
    battle_losses: int
    battle_win_rate: float
    battle_streak: int
    dominations: int = 0
    invasions: int = 0
    most_recent_status: str
    overall_score: float
    rank: Optional[int] = None

class Kingdom(KingdomBase):
    last_updated: datetime
    recent_kvks: List['KVKRecord'] = []
    
    class Config:
        from_attributes = True

class KVKRecordBase(BaseModel):
    kingdom_number: int
    kvk_number: int
    opponent_kingdom: int
    prep_result: str
    battle_result: str
    overall_result: str
    date_or_order_index: str

class KVKRecord(KVKRecordBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class KingdomProfile(Kingdom):
    recent_kvks: List[KVKRecord] = []

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r'^[a-zA-Z0-9_-]+$')
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128)
    
    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not re.search(r'[A-Za-z]', v):
            raise ValueError('Password must contain at least one letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        return v

class User(UserBase):
    id: int
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None


# Submission schemas
class KVKSubmissionCreate(BaseModel):
    kingdom_number: int = Field(..., ge=1, le=9999, description="Kingdom number (1-9999)")
    kvk_number: int = Field(..., ge=1, le=999, description="KvK event number")
    opponent_kingdom: int = Field(..., ge=1, le=9999, description="Opponent kingdom number")
    prep_result: Literal['W', 'L'] = Field(..., description="Prep phase result: W or L")
    battle_result: Literal['W', 'L'] = Field(..., description="Battle phase result: W or L")
    date_or_order_index: Optional[str] = Field(None, max_length=50)
    screenshot_url: Optional[str] = Field(None, max_length=500, pattern=r'^https?://')
    notes: Optional[str] = Field(None, max_length=1000)
    
    @field_validator('opponent_kingdom')
    @classmethod
    def opponent_different(cls, v: int, info) -> int:
        if 'kingdom_number' in info.data and v == info.data['kingdom_number']:
            raise ValueError('Opponent kingdom cannot be the same as the kingdom')
        return v

class KVKSubmission(BaseModel):
    id: int
    submitter_id: str
    submitter_name: Optional[str]
    kingdom_number: int
    kvk_number: int
    opponent_kingdom: int
    prep_result: str
    battle_result: str
    date_or_order_index: Optional[str]
    screenshot_url: Optional[str]
    screenshot2_url: Optional[str]
    notes: Optional[str]
    status: str
    reviewed_by: Optional[str]
    review_notes: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class SubmissionReview(BaseModel):
    status: Literal['approved', 'rejected'] = Field(..., description="Review decision")
    review_notes: Optional[str] = Field(None, max_length=500)


# Kingdom claim schemas
class KingdomClaimCreate(BaseModel):
    kingdom_number: int = Field(..., ge=1, le=9999)

class KingdomClaimUpdate(BaseModel):
    custom_banner_url: Optional[str] = Field(None, max_length=500, pattern=r'^https?://')
    custom_description: Optional[str] = Field(None, max_length=2000)
    discord_link: Optional[str] = Field(None, max_length=200, pattern=r'^https?://(discord\.gg|discord\.com)/')
    recruitment_status: Optional[Literal['open', 'closed', 'selective']] = None

class KingdomClaim(BaseModel):
    id: int
    kingdom_number: int
    user_id: str
    status: str
    verification_code: Optional[str]
    verified_at: Optional[datetime]
    is_premium: bool
    premium_expires_at: Optional[datetime]
    custom_banner_url: Optional[str]
    custom_description: Optional[str]
    discord_link: Optional[str]
    recruitment_status: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
