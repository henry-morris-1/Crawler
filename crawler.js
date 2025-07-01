'use strict'

import puppeteer from 'puppeteer'
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'

const queued = new Set()
const visited = new Set()

const maxThreads = navigator.hardwareConcurrency || process.env.DEFAULT_MAX_THREADS

if (isMainThread) {

    createWorker(process.env.START_URL, true)

} else {

    const browser = await puppeteer.launch({ browser: 'firefox' })
    const page = await browser.newPage()
    await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false
    })

    try {

        await page.goto(workerData.url, { waitUntil: 'networkidle0' })

        let links = []
        if (workerData.doSearch) {
            links = await getLinks(page)
        }

        parentPort.postMessage({
            url: workerData.url,
            links: links
        })

    } catch (error) {

        parentPort.postMessage({
            url: workerData.url,
            links: []
        })

    } finally {

        await browser.close()

    }

}

function createWorker(url, isFirst = false) {

    const enoughItemsQueued = (visited.size + queued.size) >= process.env.MAX_PAGES

    const worker = new Worker(import.meta.filename, { workerData: { url: url, doSearch: !enoughItemsQueued } })

    worker.on('message', message => {

        visited.add(message.url)

        message.links.forEach(link => {

            const isNew = link != message.url && !queued.has(link) && !visited.has(link)

            if (!enoughItemsQueued && isNew) {
                queued.add(link)
            }

        })

    })
    worker.on('exit', () => {

        if (isFirst) {

            for (let i = 0; i < Math.min(maxThreads, queued.size); i++) {
                addWorker()
            }

        } else {

            addWorker()

        }

    })
    worker.on('error', error => {

        throw error

    })

}

function addWorker() {

    if (queued.size > 0 && visited.size < process.env.MAX_PAGES) {

        const url = Array.from(queued)[0]
        queued.delete(url);

        createWorker(url)

    }

}

async function getLinks(page) {

    const links = await page.$$eval('a', as => as.map(a => a.href))
    return links.filter(link => validate(link))

}

function validate(url) {

    return url.length > 0 && /^https?:\/\//.test(url)

}