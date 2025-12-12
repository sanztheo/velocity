Write a query to find inactive users
List Tables
Success
View Result
Get Table Schema
Success
Arguments:
{
"table_name": "users"
}
View Result
Get Database Schema
Success
View Result
Get Table Preview
Success
Arguments:
{
"table_name": "users",
"limit": 5
}
View Result
Analysis

Request: Write a SQL query to find inactive users.

Definition of "inactive": Users with no last_login_at (never logged in) or last_login_at older than 90 days. This uses the users table's last_login_at timestamp.

Dependencies: Confirmed users table exists with relevant columns (id, email, first_name, last_name, last_login_at, is_active).

Plan:

Query users table filtering on last_login_at.

Include key fields: id, email, names, last_login_at, created_at.

Optionally filter is_active = true to exclude deactivated accounts.

Query

SELECT
id,
email,
first_name,
last_name,
last_login_at,
created_at,
is_active
FROM users
WHERE (last_login_at IS NULL OR last_login_at < NOW() - INTERVAL '90 days')
AND is_active = true
ORDER BY last_login_at ASC NULLS FIRST;

Explanation

Filters for inactivity based on last_login_at.

Orders by oldest/missing logins first.

Adjust the interval (e.g., '30 days') as needed.

To execute and verify results, use run_sql_query if required.

This query is ready to run and efficient (uses indexed timestamp likely).
