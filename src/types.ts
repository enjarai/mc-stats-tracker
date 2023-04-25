export type SentProjectDataPoint = {
    project: string;
    timestamp: number;
    downloads: number;
    downloads_diff: number;
    followers: number;
    versions: number;
};

export type ProjectDataPoint = {
    project: string;
    timestamp: number;
    downloads: number;
    followers: number;
    versions: number;
}

export type ProjectData = {
    downloads: number;
    followers: number;
    versions: number;
}