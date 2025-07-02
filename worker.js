'use strict'
import puppeteer from 'puppeteer'
import { parentPort, threadId } from 'worker_threads'


log('starting')

const browser = await puppeteer.launch({ browser: 'firefox' })
const page = await browser.newPage()


parentPort.on('message', handleMessage)


async function handleMessage(message) {

    if (message.url) {

        log('visiting: ' + message.url)

        try {

            await page.goto(message.url, { waitUntil: 'networkidle2' })
            const links = await getLinks(page)

            parentPort.postMessage({
                url: message.url,
                links: links
            })

        } catch (error) {

            log('closing on ERROR')
            await browser.close()
            process.exit(1)

        }

    } else {

        log('closing')
        await browser.close()
        process.exit(0)

    }

}

async function getLinks(page) {

    const links = await page.$$eval('a', as => as.map(a => a.href))
    return links.filter(link => validate(link))

}

function validate(url) {

    return url.length > 0 && /^https?:\/\//.test(url)

}

function log(message) {

    console.log('pid ' + threadId + (threadId < 10 ? ' ' : '') + ' | ' + message)

}