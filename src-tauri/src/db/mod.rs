pub mod models;
pub mod repository;
#[cfg(test)]
mod tests;

use std::path::Path;

use r2d2_sqlite::SqliteConnectionManager;
use rusqlite_migration::{Migrations, M};

pub type Pool = r2d2::Pool<SqliteConnectionManager>;

fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(include_str!("migrations/0001_init.sql"))])
}

/// Opens (creating if needed) the SQLite database at `data_dir/pinote.sqlite3`,
/// applies pending migrations and returns a connection pool.
pub fn init_pool(data_dir: &Path) -> Result<Pool, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(data_dir)?;
    let db_path = data_dir.join("pinote.sqlite3");

    let manager = SqliteConnectionManager::file(&db_path).with_init(|conn| {
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
    });
    let pool = r2d2::Pool::new(manager)?;

    let mut conn = pool.get()?;
    migrations().to_latest(&mut conn)?;

    Ok(pool)
}
