"""Prints what a SQLite database holds, as JSON, for the viewer's database view: view_file.ps1 runs it.

Usage: db_view.py <file.sqlite>

The database is opened read-only (`file:...?mode=ro`), which also sees what a program left in its WAL
file; when that fails (another program holds it locked, its folder cannot be written), it is opened again
as immutable (`mode=ro&immutable=1`), which takes no lock and reads only the main file. The JSON is
`{"tables": [{"name", "type", "columns", "count", "rows"}]}`: every table and view with its column
names, its row count and its first 500 rows, each value as text (NULL as an empty string, a blob as
`<blob N bytes>`). Exit code 1 and one line on stderr when the file cannot be read as a database.
"""

import json
import pathlib
import sqlite3
import sys

ROW_CAP = 500
CELL_CAP = 2000


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def cell(value):
    if value is None:
        return ''
    if isinstance(value, (bytes, bytearray, memoryview)):
        return f'<blob {len(value)} bytes>'
    text = str(value)
    return text if len(text) <= CELL_CAP else text[:CELL_CAP] + '...'


def read(uri):
    connection = sqlite3.connect(uri, uri=True, timeout=0.5)
    # Text a program stored in another encoding still shows, with replacement marks.
    connection.text_factory = lambda raw: raw.decode('utf-8', 'replace')
    try:
        objects = connection.execute(
            "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') "
            "AND name NOT LIKE 'sqlite_%' ORDER BY type, name"
        ).fetchall()
        tables = []
        for name, kind in objects:
            entry = {'name': name, 'type': kind, 'columns': [], 'count': 0, 'rows': [], 'error': ''}
            try:
                cursor = connection.execute(f'SELECT * FROM {quote(name)} LIMIT {ROW_CAP}')
                entry['columns'] = [column[0] for column in cursor.description or []]
                entry['rows'] = [[cell(value) for value in row] for row in cursor.fetchall()]
                entry['count'] = connection.execute(f'SELECT count(*) FROM {quote(name)}').fetchone()[0]
            except sqlite3.Error as error:
                # A view over a missing table, a virtual table without its module: told, not fatal.
                entry['error'] = f'{type(error).__name__}: {error}'
            tables.append(entry)
        return tables
    finally:
        connection.close()


def main():
    sys.stdout.reconfigure(encoding='utf-8', newline='\n')
    try:
        uri = pathlib.Path(sys.argv[1]).resolve().as_uri() + '?mode=ro'
        try:
            tables = read(uri)
        except sqlite3.OperationalError:
            tables = read(uri + '&immutable=1')
    except Exception as error:  # noqa: BLE001 - any failure is told to the viewer as text
        print(f'{type(error).__name__}: {error}', file=sys.stderr)
        sys.exit(1)
    json.dump({'tables': tables}, sys.stdout, ensure_ascii=True)


if __name__ == '__main__':
    main()
