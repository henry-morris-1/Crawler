'use strict'

import puppeteer from 'puppeteer'
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'

const queued = new Set()
const visited = new Set()

const maxThreads = navigator.hardwareConcurrency-1 || process.env.DEFAULT_MAX_THREADS
const threads = new Set()

if (isMainThread) {

    createWorker(process.env.START_URL, true)

} else {

    const browser = await puppeteer.launch({ browser: 'firefox' })
    const page = await browser.newPage()

    parentPort.on('message', async message => {

        console.log(message.url)

        if (message.url) {

            try {

                await page.goto(message.url, { waitUntil: 'networkidle2' })
                const links = await getLinks(page)

                parentPort.postMessage({
                    url: message.url,
                    links: links
                })

            } catch (error) {

                parentPort.postMessage({
                    url: message.url,
                    links: []
                })

            }

        } else {

            await browser.close()
            parentPort.postMessage('finished')

        }

    })

}

function createWorker(url, isFirst = false) {

    console.log('thread created')

    const worker = new Worker(import.meta.filename)

    worker.on('online', () => {

        worker.postMessage({ url: url })

    })
    worker.on('message', message => {

        if (message.url) {

            visited.add(message.url)

                message.links.forEach(link => {

                    if (link !== message.url && !queued.has(link) && !visited.has(link)) {
                        queued.add(link)
                    }

                })

                if (isFirst) {

                    for (let i = 0; i < Math.min(maxThreads, queued.size); i++) {
                        assignTask()
                    }

                } else {

                    assignTask(worker)

                }

        } else {

            worker.terminate()

        }

    })
    worker.on('exit', () => {

        console.log('thread deleted')
        threads.delete(worker)
        assignTask()

    })
    worker.on('error', error => {

        throw error

    })

    threads.add(worker)

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
        

    } else {

        if (worker) {

            worker.postMessage({})

        }

        if (threads.size == 0) {

            console.log(visited.size + ' pages visited')
            console.log(queued.size + ' pages queued')

        }

    }

}

async function getLinks(page) {

    const links = await page.$$eval('a', as => as.map(a => a.href))
    return links.filter(link => validate(link))

}

function validate(url) {

    return url.length > 0 && /^https?:\/\//.test(url)

}