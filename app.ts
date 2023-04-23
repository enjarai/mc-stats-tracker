import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import fetch from 'cross-fetch';
import { CronJob } from 'cron';
import { Database } from 'sqlite3';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const queryCron = process.env.QUERY_CRON || '0 */3 * * *';
const modrinthMods = process.env.MODRINTH_MODS?.split(',') || ['show-me-your-skin', 'do-a-barrel-roll'];
const db = new Database('data.sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS stats (
    type TEXT NOT NULL,
    project TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    downloads INTEGER NOT NULL,
    followers INTEGER,
    versions INTEGER
  );
`);

const job = new CronJob(queryCron, async () => {
  const now = new Date();
  console.log(`⏰ Querying mod downloads at ${now.toTimeString()}`);
  const stmt = db.prepare('INSERT INTO stats VALUES ("modrinth", ?, ?, ?, ?, ?);');

  for (const mod of modrinthMods) {
    const data = await (await fetch(`https://api.modrinth.com/v2/project/${mod}`)).json() as any;

    stmt.run(mod, now, data.downloads, data.followers, data.versions.length);
    console.log(`✅ Fetched ${mod}`);
  }

  stmt.finalize();
});
job.start();

app.get('/downloads/modrinth', (req: Request, res: Response) => {
  const query = `
    SELECT 
      timestamp, project, downloads, followers, versions 
    FROM stats 
    WHERE type = "modrinth" 
    ORDER BY timestamp ASC;
  `;
  const resJson: Record<string, any> = {};

  db.each(query, (err, row: any) => {
    const project = row.project as string;
    const snapshots = resJson[project] || [];

    snapshots.push({
      timestamp: row.timestamp,
      downloads: row.downloads,
      followers: row.followers,
      versions: row.versions,
    });

    resJson[project] = snapshots;
  }).wait(() => {
    res.send(resJson);
  });
});

app.listen(port, () => {
  console.log(`⚡️ Server is running at http://localhost:${port}`);
  console.log(`📝 Tracking data for the following mods: ${modrinthMods}`);
});
