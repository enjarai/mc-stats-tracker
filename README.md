# mc-stats-tracker

Simple node.js app to track statistics from the Modrinth API and present them in a json endpoint.

To setup and run, assuming [npm](https://www.npmjs.com/) is available:

```sh
npm install
npm run build
npm run start
```

## Docker Usage

When building a docker image via the dockerfile, you must pre-prepare the `config.yaml` file:

- Ensure the port is set to `8080`.

To build and run the image, use the following command (you may change the routed port):

```bash
# Build the image.
docker build -t mc_stats_fetcher -f Dockerfile .

# Run the image, port 8080 is mapped to port 8192 in this example.
# 
docker run -i -p 8192:8080 -v mc_stats_db_vol:/usr/src/app/data.sqlite -t mc_stats_fetcher:latest
```