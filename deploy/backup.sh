#!/usr/bin/env bash
# Nightly backup of the farah-nuxt live data: SQLite DB + uploaded images.
# Run from cron; safe to run while the site is up (uses VACUUM INTO for a
# consistent DB snapshot instead of copying the live file).
#
#   DB snapshots -> $BACKUP_ROOT/db/farah-YYYYmmdd-HHMMSS.db
#   uploads      -> $BACKUP_ROOT/uploads/uploads-YYYYmmdd-HHMMSS.tar.gz
#
# Keeps the newest $KEEP of each; older ones are deleted.

set -euo pipefail

APP_DIR="/home/hal/coding/farah-nuxt"
DB_FILE="$APP_DIR/.data/farah.db"
UPLOADS_DIR="$APP_DIR/uploads"
BACKUP_ROOT="/home/hal/backups/farah"
KEEP=14
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_ROOT/db" "$BACKUP_ROOT/uploads"
cd "$APP_DIR"  # so node resolves @libsql/client from the project's node_modules

# --- DB: consistent snapshot via VACUUM INTO (works on a live WAL db) ---
DB_OUT="$BACKUP_ROOT/db/farah-$STAMP.db"
node --input-type=module - "$DB_FILE" "$DB_OUT" <<'EOF'
import { createClient } from '@libsql/client'
const [db, out] = process.argv.slice(2)
const client = createClient({ url: `file:${db}` })
await client.execute(`VACUUM INTO '${out.replace(/'/g, "''")}'`)
client.close()
EOF

# Sanity check: the snapshot must be a readable SQLite db with a posts table.
node --input-type=module - "$DB_OUT" <<'EOF'
import { createClient } from '@libsql/client'
const client = createClient({ url: `file:${process.argv[2]}` })
const r = await client.execute('SELECT count(*) AS n FROM posts')
console.log(`db snapshot ok: ${r.rows[0].n} posts`)
client.close()
EOF

# --- uploads: plain tarball ---
tar -czf "$BACKUP_ROOT/uploads/uploads-$STAMP.tar.gz" -C "$APP_DIR" uploads
echo "uploads ok: $(du -h "$BACKUP_ROOT/uploads/uploads-$STAMP.tar.gz" | cut -f1)"

# --- rotation: keep the newest $KEEP of each kind ---
for dir in "$BACKUP_ROOT/db" "$BACKUP_ROOT/uploads"; do
  ls -1t "$dir" | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$dir/$old"
    echo "pruned $dir/$old"
  done
done

echo "backup done: $STAMP"
