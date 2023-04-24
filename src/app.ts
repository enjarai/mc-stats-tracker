import express, { Request, Response } from 'express';
import fetch, { Headers } from 'cross-fetch';
import { CronJob } from 'cron';
import { Database } from 'sqlite3';
import { parse } from 'yaml';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path, { dirname, resolve } from 'path';

const config = parse(readFileSync('config.yaml', 'utf-8'));
const app = express();
const port = config?.port || 8080;
const queryCron = config?.query_cron || '0 */3 * * *';
const users = config?.users || [];
const projects = config?.projects || [];
const sources = config?.sources || []; 
const dbPath = config?.db_path || './data.sqlite';

const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS stats (
    type TEXT NOT NULL,
    project TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    downloads INTEGER NOT NULL,
    followers INTEGER,
    versions INTEGER
  );
  CREATE TABLE IF NOT EXISTS revenue (
    type TEXT NOT NULL,
    user TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    all_time_balance REAL NOT NULL,
    balance REAL NOT NULL
  );
`);

const job = new CronJob({cronTime: queryCron, runOnInit: true, onTick: async () => {
  const now = new Date();
  console.log(`⏰ Querying mod downloads at ${now.toTimeString()}`);
  const stmt = db.prepare('INSERT INTO stats VALUES (?, ?, ?, ?, ?, ?);');

  for (const user of users) {
    try {
      for (const source in user.source_ids || []) {
        const sourceData = sources[source];
        const url = `${sourceData.base_url}/user/${user.source_ids[source]}/projects`;
        const data = await (await fetch(url)).json() as any;

        for (const mod of data) {
          stmt.run(source, mod.slug, now, mod.downloads, mod.followers, mod.versions.length);

          console.log(`✅ Fetched data for ${mod.slug} (${user.id}) from ${Object.keys(user.source_ids)}`);
        }
      } 
    } catch (e) {
      console.error(`💥 Error fetching data for user ${user.id}: `, e)
    }
  } 

  for (const mod of projects) {
    try {
      for (const source in mod.source_ids || []) {
        const sourceData = sources[source];
        const url = `${sourceData.base_url}/project/${mod.source_ids[source]}`;
        const data = await (await fetch(url)).json() as any;

        stmt.run(source, mod.id, now, data.downloads, data.followers, data.versions.length);
      } 
      console.log(`✅ Fetched data for ${mod.id} from ${Object.keys(mod.source_ids)}`);
    } catch (e) {
      console.error(`💥 Error fetching data for project ${mod.id}: `, e)
    }
  }

  stmt.finalize();

  console.log(`📝 Querying revenue statistics at ${now.toTimeString()}`)

  const rstmt = db.prepare('INSERT INTO revenue VALUES (?, ?, ?, ?, ?);')

  for (const user of users) { 
    try {
      for (const source in user.source_ids || []) {
        const sourceData = sources[source]
        if(!sourceData.token) continue

        const requestOptions = {
          method: 'GET',
          headers: {
            'Authorization': sourceData.token
          }
        }

        const balanceURL = `${sourceData.base_url}/user`
        const balanceData = await (await fetch(balanceURL, requestOptions)).json() as any
        const payoutInfoURL = `${sourceData.base_url}/user/${user.source_ids[source]}/payouts`
        const payoutData = await (await fetch(payoutInfoURL, requestOptions)).json() as any
   
        const formatter =  new Intl.NumberFormat('en-US')

        rstmt.run(source, user.id, now, payoutData.all_time, balanceData.payout_data.balance)

        console.log(`✅ Fetched revenue data from ${source} (${user.source_ids[source]})`)
      }
    } catch (e) {
      console.error(`💥 Error fetching revenue data: ${e}`)
    }
  } 

  rstmt.finalize();
}});
job.start();

app.get('/revenue/:user/:source', (req: Request, res: Response) => {
  const source = req.params.source;
  const user = req.params.user;
  const query = `
    SELECT 
      user, timestamp, all_time_balance, balance
    FROM revenue
    WHERE type = ? AND user = ?
    ORDER BY timestamp ASC
  `;

  const resJSON: any[] = [];

  db.each(query, source, user, (_err: any, row: any) => {
    resJSON.push({
      timestamp: row.timestamp,
      all_time_balance: row.all_time_balance,
      balance: row.balance
    })
  }, (_err: any, _count: any) => {
    res.send(resJSON);
  });
});

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
  console.log(`📝 Tracking data for the following users: ${users.map((i: any) => i.id)}`);
  console.log(`📝 Tracking data for the following projects: ${projects.map((i: any) => i.id)}`);
});
