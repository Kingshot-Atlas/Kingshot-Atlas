# Kingshot Atlas API

Backend API for Kingshot Atlas kingdom data analysis and comparison.

## Features

- **Kingdom Management**: List, filter, and view kingdom profiles
- **Leaderboards**: Multiple sorting options for kingdom rankings
- **Comparison Tools**: Compare multiple kingdoms side-by-side
- **Authentication**: Role-based user system (placeholder implementation)
- **Data Import**: CSV import script for kingdom data

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/giovanni/projects/ai/Kingshot\ Atlas/apps/api
pip install -r requirements.txt
```

### 2. Import Data

```bash
python import_data.py
```

This will:
- Create SQLite database (`kingshot_atlas.db`)
- Import kingdoms summary data
- Import KVK records
- Set up database tables

### 3. Run the API Server

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Kingdoms

- `GET /api/kingdoms` - List all kingdoms with filters and sorting
  - Query parameters: `search`, `status`, `minKvks`, `minPrepWR`, `minBattleWR`, `sort`, `order`
- `GET /api/kingdoms/{kingdom_number}` - Get detailed kingdom profile with recent KVKs

### Leaderboard

- `GET /api/leaderboard` - Get ranked list of kingdoms
  - Query parameters: `sort_by`, `limit`, `offset`
- `GET /api/leaderboard/top-by-status` - Get top kingdoms by status

### Comparison

- `GET /api/compare` - Compare multiple kingdoms
  - Query parameter: `kingdoms` (comma-separated, e.g., "K123,K456")
- `GET /api/compare/head-to-head` - Head-to-head comparison between two kingdoms
  - Query parameters: `kingdom1`, `kingdom2`

### Authentication (Placeholder)

- `POST /api/auth/register` - Register new user
- `POST /api/auth/token` - Login and get access token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout
- `GET /api/auth/admin-only` - Admin-only endpoint
- `GET /api/auth/moderator-only` - Moderator-only endpoint

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Testing

### Basic API Tests

```bash
# Health check
curl http://localhost:8000/health

# List kingdoms
curl "http://localhost:8000/api/kingdoms?sort=overall_score&order=desc&limit=10"

# Get specific kingdom
curl http://localhost:8000/api/kingdoms/1

# Get leaderboard
curl "http://localhost:8000/api/leaderboard?sort_by=overall_score&limit=5"

# Compare kingdoms
curl "http://localhost:8000/api/compare?kingdoms=1,2,3"
```

### Authentication Tests

```bash
# Register user
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "email": "test@example.com", "password": "testpass"}'

# Login
curl -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=testpass"
```

## Database Schema

### Kingdoms Table
- `kingdom_number` (PK) - Kingdom identifier
- `total_kvks` - Total KVK battles participated
- `prep_wins/losses` - Preparation phase win/loss record
- `prep_win_rate` - Preparation win percentage
- `prep_streak` - Current preparation win streak
- `battle_wins/losses` - Battle phase win/loss record
- `battle_win_rate` - Battle win percentage
- `battle_streak` - Current battle win streak
- `most_recent_status` - Current kingdom status
- `overall_score` - Combined performance score

### KVK Records Table
- `id` (PK) - Record identifier
- `kingdom_number` - Kingdom reference
- `kvk_number` - KVK event number
- `opponent_kingdom` - Opponent kingdom number
- `prep_result` - Preparation phase result (W/L)
- `battle_result` - Battle phase result (W/L)
- `overall_result` - Overall result (W/L)
- `date_or_order_index` - Event date or order

### Users Table
- `id` (PK) - User identifier
- `username` - Unique username
- `email` - Unique email
- `hashed_password` - Hashed password
- `role` - User role (user/moderator/admin)
- `is_active` - Account status
- `created_at` - Registration timestamp

## Configuration

### Environment Variables

- `DATABASE_URL` - Database connection string (default: SQLite)
  - SQLite: `sqlite:///./kingshot_atlas.db`
  - PostgreSQL: `postgresql://user:password@localhost/dbname`

### Database Setup (PostgreSQL)

If using PostgreSQL instead of SQLite:

1. Install PostgreSQL driver:
```bash
pip install psycopg2-binary
```

2. Set DATABASE_URL:
```bash
export DATABASE_URL="postgresql://username:password@localhost/kingshot_atlas"
```

3. Create database and run import script.

## Development

### Project Structure

```
apps/api/
├── main.py              # FastAPI application entry point
├── database.py          # Database configuration
├── models.py            # SQLAlchemy models
├── schemas.py           # Pydantic schemas
├── import_data.py       # CSV import script
├── api/
│   └── routers/
│       ├── kingdoms.py  # Kingdom endpoints
│       ├── leaderboard.py # Leaderboard endpoints
│       ├── compare.py   # Comparison endpoints
│       └── auth.py      # Authentication endpoints
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

### Adding New Endpoints

1. Create new router in `api/routers/`
2. Define schemas in `schemas.py`
3. Add models in `models.py` if needed
4. Include router in `main.py`

## Deployment

### Docker (Optional)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Production Considerations

- Use PostgreSQL instead of SQLite for production
- Implement proper JWT authentication
- Add rate limiting
- Set up proper CORS origins
- Add logging and monitoring
- Use environment variables for secrets

## Troubleshooting

### Common Issues

1. **Import Error**: Make sure CSV files exist in `../../data/processed/`
2. **Database Lock**: Stop the server before re-running import script
3. **Module Not Found**: Run from the `apps/api` directory
4. **Port Already in Use**: Change port with `--port 8001`

### Data Validation

The import script validates:
- Kingdom numbers are integers
- Win rates are between 0 and 1
- Required fields are present
- Data types match expected formats

## Support

For issues or questions:
1. Check the API documentation at `/docs`
2. Verify data files exist and are properly formatted
3. Ensure all dependencies are installed
4. Check database connection and permissions
