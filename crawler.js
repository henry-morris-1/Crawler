'use strict'
import { Worker } from 'worker_threads'


const queued = new Set()
const visited = new Set()

const maxThreads = navigator.hardwareConcurrency-1 || process.env.DEFAULT_MAX_THREADS
const threads = new Set()
let threadCount = 0


createWorker(process.env.START_URL)


function createWorker(url) {

    const worker = new Worker('./worker.js')

    threads.add(worker)
    threadCount++

    worker.on('online', () => {

        worker.postMessage({ url: url })

    })
    worker.on('message', message => {

        visited.add(message.url)

        message.links.forEach(link => {

            if (link !== message.url && !queued.has(link) && !visited.has(link)) {
                queued.add(link)
            }

        })

        assignTask(worker)

        for (let i = threadCount; i < Math.min(maxThreads-1, queued.size); i++) {
            assignTask()
        }

    })
    worker.on('exit', () => {

        threads.delete(worker)
        threadCount--

        if (threadCount == 0) {
            console.log(`---\n${visited.size} pages visited\n${queued.size} pages remain queued`)
        }

    })
    worker.on('error', error => {

        throw error

    })

}

function assignTask(worker) {

    if (queued.size > 0 && (visited.size + threads.size) < process.env.MAX_PAGES) {

        const url = Array.from(queued)[0]
        queued.delete(url)

        if (worker) {
            worker.postMessage({ url: url })

        } else {
            createWorker(url)
        }

    } else if (worker) {
        worker.postMessage({})
    }

}