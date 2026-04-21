class DownloadQueue {
    constructor(maxConcurrent = 2) {
        this.queue = [];
        this.activeDownloads = new Map();
        this.maxConcurrent = maxConcurrent;
        this.processing = false;
    }

    // Add a download job to the queue
    async addJob(job) {
        return new Promise((resolve, reject) => {
            const queueItem = {
                job,
                resolve,
                reject,
                id: Date.now() + Math.random(),
                addedAt: new Date()
            };

            this.queue.push(queueItem);

            // Start processing if not already running
            if (!this.processing) {
                this.processQueue();
            }

            console.log(`📋 Job added to queue. Position: ${this.queue.length}`);
        });
    }

    // Process the queue
    async processQueue() {
        if (this.processing) return;

        this.processing = true;

        while (this.queue.length > 0) {
            // Check if we can start more downloads
            if (this.activeDownloads.size >= this.maxConcurrent) {
                // Wait for a download to complete
                await this.waitForDownloadCompletion();
            }

            // Get next job
            const queueItem = this.queue.shift();
            if (!queueItem) continue;

            // Start the download
            this.startDownload(queueItem);
        }

        this.processing = false;
    }

    // Start a download job
    async startDownload(queueItem) {
        const { job, resolve, reject, id } = queueItem;

        try {
            // Mark as active
            this.activeDownloads.set(id, {
                job,
                startTime: new Date(),
                status: 'processing'
            });

            console.log(`▶️ Starting download job ${id}`);

            // Execute the job
            const result = await job();

            // Mark as completed
            this.activeDownloads.set(id, {
                ...this.activeDownloads.get(id),
                status: 'completed',
                endTime: new Date()
            });

            console.log(`✅ Download job ${id} completed`);
            resolve(result);

        } catch (error) {
            // Mark as failed
            this.activeDownloads.set(id, {
                ...this.activeDownloads.get(id),
                status: 'failed',
                endTime: new Date(),
                error: error.message
            });

            console.log(`❌ Download job ${id} failed:`, error.message);
            reject(error);
        } finally {
            // Remove from active downloads
            this.activeDownloads.delete(id);
        }
    }

    // Wait for any download to complete
    async waitForDownloadCompletion() {
        return new Promise((resolve) => {
            const checkCompletion = () => {
                if (this.activeDownloads.size < this.maxConcurrent) {
                    resolve();
                } else {
                    // Check again in 1 second
                    setTimeout(checkCompletion, 1000);
                }
            };
            checkCompletion();
        });
    }

    // Get queue status
    getStatus() {
        return {
            queueLength: this.queue.length,
            activeDownloads: this.activeDownloads.size,
            maxConcurrent: this.maxConcurrent,
            activeJobs: Array.from(this.activeDownloads.entries()).map(([id, job]) => ({
                id,
                status: job.status,
                duration: job.startTime ? (new Date() - job.startTime) : 0
            }))
        };
    }

    // Get position in queue for a specific user
    getQueuePosition(userId) {
        // This would require tracking user IDs in the queue
        // For now, return general queue info
        const status = this.getStatus();
        return {
            position: status.queueLength,
            active: status.activeDownloads,
            estimatedWait: this.estimateWaitTime()
        };
    }

    // Estimate wait time based on current active downloads
    estimateWaitTime() {
        const status = this.getStatus();
        if (status.activeDownloads < this.maxConcurrent) {
            return 0; // Can start immediately
        }

        // Rough estimate: assume average download takes 2 minutes
        const avgDownloadTime = 2 * 60 * 1000; // 2 minutes in ms
        const slotsAvailable = this.maxConcurrent - status.activeDownloads;

        if (slotsAvailable > 0) {
            return 0; // Slot available
        }

        // Estimate based on queue position
        return Math.ceil(status.queueLength / this.maxConcurrent) * avgDownloadTime;
    }

    // Cancel a job (if needed)
    cancelJob(jobId) {
        // Remove from queue if not started
        this.queue = this.queue.filter(item => item.id !== jobId);

        // Cancel active job if possible
        const activeJob = this.activeDownloads.get(jobId);
        if (activeJob) {
            // Note: Actual cancellation would require job-specific cancellation logic
            console.log(`Attempting to cancel active job ${jobId}`);
        }
    }
}

module.exports = DownloadQueue;