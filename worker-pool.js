'use strict'

import { Worker } from 'worker_threads'


class WorkerPool {

    constructor(path, queue) {
        this.path = path
        this.queue = queue
        this.active = new Map()
        this.maxThreads = navigator.hardwareConcurrency-1 || process.env.DEFAULT_MAX_THREADS
        this.workers = new Set()

        for (let i = 0; i < maxThreads; i++) {
            this.createWorker()
        }
    }

    createWorker() {
        const worker = new Worker(path)

        worker.on('message', message => {
            const { resolve } = this.active.get(message.url)
            resolve(message)
            this.active.delete(message.url)
            this.findTask(worker)
        })
        worker.on('exit', () => {
            workers.add(worker)
            this.createWorker()
        })
        worker.on('error', error => {
            throw error
        })

        workers.add(worker)
    }

    findTask(worker) {
        if (this.queue.length === 0) return

        const idleWorker = worker || Array.from(this.workers).find(worker => ![...this.active.values()].some(w => w === worker))

        if (!idleWorker) return

        const { task, resolve } = this.queue.shift()
        this.active.set(task, { worker: idleWorker, resolve })
        idleWorker.postMessage(task)
    }

    runTask(task) {
        return new Promise(resolve => {
            this.queue.push({ task, resolve })
            this.findTask()
        })
    }

    destroy() {
        this.workers.forEach(worker => {
            worker.terminate()
        })
    }

}

module.exports = WorkerPool