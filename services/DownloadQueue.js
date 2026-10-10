const { randomUUID } = require('node:crypto');

class DownloadQueue {
    constructor(maxConcurrent = 2) {
        if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
            throw new Error('maxConcurrent must be a positive integer');
        }
        this.maxConcurrent = maxConcurrent;
        this.waitingJobs = [];
        this.activeJobs = new Map();
    }

    addJob(run, ownerId) {
        return new Promise((resolve, reject) => {
            this.waitingJobs.push({ id: randomUUID(), run, ownerId, resolve, reject });
            this.startWaitingJobs();
        });
    }

    startWaitingJobs() {
        while (this.waitingJobs.length && this.activeJobs.size < this.maxConcurrent) {
            const job = this.waitingJobs.shift();
            this.activeJobs.set(job.id, job);
            void this.runJob(job);
        }
    }

    async runJob(job) {
        try {
            job.resolve(await job.run());
        } catch (error) {
            job.reject(error);
        } finally {
            this.activeJobs.delete(job.id);
            this.startWaitingJobs();
        }
    }

    getStatus(ownerId) {
        const position = this.waitingJobs.findIndex(job => job.ownerId === ownerId);
        return {
            activeDownloads: this.activeJobs.size,
            maxConcurrent: this.maxConcurrent,
            queueLength: this.waitingJobs.length,
            position: position + 1,
            userActive: [...this.activeJobs.values()].some(job => job.ownerId === ownerId)
        };
    }
}

module.exports = DownloadQueue;
