import express, { Request, Response } from 'express';
import fetch from 'cross-fetch';
import { CronJob } from 'cron';
import { Database } from 'sqlite3';
import { parse } from 'yaml';
import { readFileSync } from 'fs';

const config = parse(readFileSync('config.yaml', 'utf-8'));
const app = express();
const port = config?.port || 8080;
const queryCron = config?.query_cron || '0 */3 * * *';
const projects = config?.projects || [];
const sources = config?.sources || [];
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
  const stmt = db.prepare('INSERT INTO stats VALUES (?, ?, ?, ?, ?, ?);');

  for (const mod of projects) {
    try {
      for (const source in mod.source_ids || []) {
        const sourceData = sources[source];
        const url = `${sourceData.base_url}/project/${mod.source_ids[source]}`;
        const data = await (await fetch(url)).json() as any;

        stmt.run(source, mod.id, now, data.downloads, data.followers, data.versions.length);
      } 
      console.log(`✅ Fetched ${mod.id} from ${Object.keys(mod.source_ids)}`);
    } catch (e) {
      console.error(`💥 Error fetching data for ${mod.id}: `, e)
    }
  }

  stmt.finalize();
});
job.start();

app.get('/downloads/:source', (req: Request, res: Response) => {
  const source = req.params.source;
  const query = `
    SELECT 
      timestamp, project, downloads, followers, versions 
    FROM stats 
    WHERE type = ? 
    ORDER BY timestamp ASC;
  `;
  const resJson: any[] = [];
  const lasts: Record<string, any> = {};

  db.each(query, source, (_err, row: any) => {
    resJson.push({
      project: row.project,
      timestamp: row.timestamp,
      downloads: row.downloads,
      downloads_diff: row.downloads - (lasts[row.project]?.downloads || row.downloads),
      followers: row.followers,
      versions: row.versions,
    });
    lasts[row.project] = {
      downloads: row.downloads,
      followers: row.followers,
      versions: row.versions,
    };
  }, (_err, _count) => {
    res.send(resJson);
  });
});

app.listen(port, () => {
  console.log(`⚡️ Server is running at http://localhost:${port}`);
  console.log(`📝 Tracking data for the following projects: ${projects.map((i: any) => i.id)}`);
});
