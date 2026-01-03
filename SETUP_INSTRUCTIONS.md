# Setup Instructions

To run this application locally or deploy it, you must configure the environment variables.

## Database Connection

The application requires a PostgreSQL database connection string. Create a `.env` file in the root directory (based on `.example.env`) and add your `DATABASE_URL`:

```bash
DATABASE_URL="postgresql://user:password@host:port/database"
```

## Security & Background Jobs

To secure the background synchronization endpoint, you must set a `CRON_SECRET`.

```bash
CRON_SECRET="your-secure-cron-secret-here"
```

## Vercel Deployment

If you are deploying to Vercel:
1. Go to your Project Settings.
2. Navigate to "Environment Variables".
3. Add a new variable named `DATABASE_URL` with your connection string as the value.
4. Add a new variable named `CRON_SECRET` (generate a strong random string).
5. Redeploy the application.

*Note: Vercel Cron will automatically use the `CRON_SECRET` to authenticate requests.*
