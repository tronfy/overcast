import Image from 'image-js'

const SIZE = 402
const GRID = 3
const TILE = SIZE / GRID

const server = Bun.serve({
  port: 3000,
  async fetch(request) {
    const url = new URL(request.url)
    const imgUrl = url.searchParams.get('img')
    const rawMask = url.searchParams.get('mask')

    if (!imgUrl) return new Response('missing img', { status: 400 })
    if (!rawMask) return new Response('missing mask', { status: 400 })
    if (rawMask.length !== GRID * GRID) return new Response('bad mask length', { status: 400 })

    // const key = Bun.hash(imgUrl)
    const res = await fetch(imgUrl)
    if (!res.ok) return new Response('bad img url', { status: 400 })

    const data = await res.arrayBuffer()
    const raw = await Image.load(data)
    const img = raw.resize({ width: SIZE, height: SIZE })
    // TODO: cache resized image

    const blurred = img.gaussianFilter({
      radius: 30,
      sigma: 20,
    })
    // TODO: cache blurred image

    const revRawMask = rawMask.split('').reverse().join('') // change to big endian
    const mask = parseInt(revRawMask, 2)
    if (isNaN(mask) || mask > 0b111111111 || mask < 0) return new Response('bad mask', { status: 400 })

    for (let i = 0; i < SIZE; i++) {
      for (let j = 0; j < SIZE; j++) {
        const shouldBlur = mask & (1 << (Math.floor(i / TILE) * 3 + Math.floor(j / TILE)))
        if (shouldBlur) {
          img.setPixelXY(j, i, blurred.getPixelXY(j, i))
        } else {
          img.setPixelXY(j, i, img.getPixelXY(j, i))
        }
      }
    }

    return new Response(img.toBuffer(), {
      headers: {
        // TODO: use correct content type
        'content-type': 'image/png',
      },
    })
  },
})

console.log(`listening on http://localhost:${server.port}`)
