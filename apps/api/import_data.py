import pandas as pd
import sys
import os
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Kingdom, KVKRecord, Base

def import_kingdoms_data():
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Clear existing data
        db.query(KVKRecord).delete()
        db.query(Kingdom).delete()
        db.commit()
        
        # Import kingdoms summary
        kingdoms_df = pd.read_csv("../../data/processed/kingdoms_summary.csv")
        
        for _, row in kingdoms_df.iterrows():
            kingdom = Kingdom(
                kingdom_number=int(row['kingdom_number']),
                total_kvks=int(row['total_kvks']),
                prep_wins=int(row['prep_wins']),
                prep_losses=int(row['prep_losses']),
                prep_win_rate=float(row['prep_win_rate']),
                prep_streak=int(row['prep_win_streak']),
                battle_wins=int(row['battle_wins']),
                battle_losses=int(row['battle_losses']),
                battle_win_rate=float(row['battle_win_rate']),
                battle_streak=int(row['battle_win_streak']),
                dominations=int(row['dominations']),
                defeats=int(row['defeats']),
                most_recent_status=str(row['most_recent_status']),
                overall_score=float(row['overall_score'])
            )
            db.add(kingdom)
        
        db.commit()
        print(f"Imported {len(kingdoms_df)} kingdoms")
        
        # Import ALL KVK records (full history for kingdom profiles)
        kvks_df = pd.read_csv("../../data/processed/kingdoms_all_kvks.csv")
        
        for _, row in kvks_df.iterrows():
            kvk_record = KVKRecord(
                kingdom_number=int(row['kingdom_number']),
                kvk_number=int(row['kvk_number']),
                opponent_kingdom=int(row['opponent_kingdom']),
                prep_result=str(row['prep_result']),
                battle_result=str(row['battle_result']),
                overall_result=str(row['overall_result']),
                date_or_order_index=f"{row['kvk_date']} ({row['order_index']})"
            )
            db.add(kvk_record)
        
        db.commit()
        print(f"Imported {len(kvks_df)} KVK records (full history)")
        
        print("Data import completed successfully!")
        
    except Exception as e:
        print(f"Error importing data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    import_kingdoms_data()
