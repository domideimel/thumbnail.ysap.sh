/**
 * Generate images based on a YouTube URL suitable for easily sharing
 *
 * # Created
 * Author: Dave Eddy <ysap@daveeddy.com>
 * Date: February 03, 2026
 * License: MIT
 *
 * # Contributors
 * - Dave Eddy <ysap@daveeddy.com>
 * - Dominik Deimel <info@dominikdeimel.com>
 */

/**
 * IIFE (Immediately Invoked Function Expression)
 *
 * This pattern is used to create a new scope for the code, preventing variables
 * and functions defined within from polluting the global namespace.
 */

(() => {
  'use strict'

  // Configuration & Constants
  const CONFIG = {
    FONT: 'Arial',
    COLORS: {
      BG: '#222',
      TEXT_PRIMARY: '#eee',
      TEXT_SECONDARY: '#aaa',
      HIGHLIGHT: '#f00',
      SHADOW: '#000',
      OVERLAY: 'rgba(0, 0, 0, 0.5)',
      BG_BLACK: 'rgba(0, 0, 0, 1.0)'
    },
    API_URL: 'https://noembed.com/embed',
    QUALITIES: ['maxresdefault', 'hqdefault', 'mqdefault', 'default'],
    CANVAS: {
      WIDTH_FULL: 1280,
      HEIGHT_FULL: 1450,
      WIDTH_LARGE: 1280,
      HEIGHT_LARGE: 1280,
      WIDTH_BASIC: 1280,
      HEIGHT_BASIC: 900,
      WIDTH_BLUR: 1280,
      HEIGHT_BLUR: 720
    }
  }

  // Application State
  const state = {
    lastVideoId: null,
    isDebug: false
  }

  // DOM Elements Cache
  const els = {
    urlForm: null,
    urlInput: null,
    downloadBtn: null,
    output: null,
    container: null,
    errorDiv: null
  }

  /**
   * Initialize Application
   */
  const init = () => {
    // Cache DOM elements
    els.urlForm = document.getElementById('url-form')
    els.urlInput = document.getElementById('url-input')
    els.downloadBtn = document.getElementById('downloadBtn')
    els.output = document.getElementById('output')
    els.container = document.getElementById('container')

    // Check debug mode
    state.isDebug = new URLSearchParams(window.location.search).has('debug')

    // Event Listeners
    els.urlForm?.addEventListener('submit', handleGenerate)
    els.downloadBtn?.addEventListener('click', downloadAll)

    // Initialize Error Display
    createErrorDisplay()
  }

  const createErrorDisplay = () => {
    const div = document.createElement('div')
    div.id = 'error'
    Object.assign(div.style, {
      display: 'none',
      color: 'red',
      margin: '10px 0'
    })

    if (els.output?.parentNode) {
      els.output.parentNode.insertBefore(div, els.output)
      els.errorDiv = div
    }
  }

  // --- UI Helpers ---

  const showError = (message) => {
    els.errorDiv?.style.setProperty('display', 'block')
    if (els.errorDiv) {
      els.errorDiv.textContent = message
    } else {
      alert(message)
    }
    console.error?.(message)
  }

  const hideError = () => {
    els.errorDiv?.style.setProperty('display', 'none')
  }

  // --- Logic Helpers ---

  const shortUrl = (videoId) => `https://youtu.be/${videoId}`

  const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(' ')
    const lines = []
    let line = ''

    for (const word of words) {
      const testLine = line + word + ' '
      const { width } = ctx.measureText(testLine)
      if (width > maxWidth && line !== '') {
        lines.push(line.trim())
        line = word + ' '
      } else {
        line = testLine
      }
    }
    if (line) lines.push(line.trim())
    return lines
  }

  const getYouTubeID = (url) => {
    try {
      const { hostname, pathname, searchParams } = new URL(url)
      if (hostname === 'youtu.be') {
        return pathname.slice(1).split(/[?#]/)[0]
      }
      if (hostname.includes('youtube.com')) {
        return searchParams.get('v') || pathname.split('/embed/')[1]?.split(/[?#]/)[0] || pathname.split('/v/')[1]?.split(/[?#]/)[0]
      }
    } catch {
      // Invalid URL format
    }
    return null
  }

  // --- Image Loading ---

  const loadBestThumbnail = async (videoId) => {
    for (const quality of CONFIG.QUALITIES) {
      const url = `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`
      try {
        if (state.isDebug) console.log(`Trying thumbnail: ${url}`)
        return await loadImage(url)
      } catch (e) {
        // Continue to next quality
        if (state.isDebug) console.error(`Failed to load ${quality} thumbnail: ${e.message}`)
      }
    }
    throw new Error('Could not load any valid thumbnail for this video.')
  }

  const loadImage = (url) => new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })

  // --- Main Actions ---

  const handleGenerate = async (event) => {
    event.preventDefault()
    hideError()

    const url = els.urlInput?.value?.trim()
    if (!url) {
      showError('Please enter a YouTube URL')
      return
    }

    const videoId = getYouTubeID(url)
    if (!videoId) {
      showError('Invalid YouTube URL')
      return
    }

    const submitBtn = els.urlForm.querySelector('button[type="submit"]')
    if (submitBtn) {
      submitBtn.disabled = true
      submitBtn.textContent = 'Generating...'
    }

    try {
      // Fetch video metadata
      const embedUrl = `${CONFIG.API_URL}?url=${encodeURIComponent(url)}`
      const res = await fetch(embedUrl)

      if (!res.ok) {
        new Error(`Failed to fetch video info: ${res.status}`)
      }

      const data = await res.json()

      if (!data.title || !data.author_name) {
        new Error('Invalid video or missing metadata')
      }

      // Load thumbnail
      const img = await loadBestThumbnail(videoId)

      // Success
      state.lastVideoId = videoId
      await drawImages(img, data, videoId)

      els.downloadBtn?.style.setProperty('display', 'inline-block')

    } catch (err) {
      showError(err.message)
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false
        submitBtn.textContent = 'Generate Images'
      }
    }
  }

  const downloadAll = () => {
    if (!state.lastVideoId) return

    const links = Array.from(els.output?.querySelectorAll('a[download]') ?? [])
    links.forEach((link, i) => {
      setTimeout(() => {
        if (state.isDebug) console.log('Downloading', link.download)
        link.click()
      }, i * 150) // Slight delay to prevent browser blocking
    })
  }

  // --- Canvas Drawing ---

  const createCanvas = (width, height) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    // Fill background immediately
    ctx.fillStyle = CONFIG.COLORS.BG
    ctx.fillRect(0, 0, width, height)

    return { canvas, ctx }
  }

  const createDownloadLink = (filename, canvas) => {
    const a = document.createElement('a')
    a.download = filename
    a.classList.add('generated')

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob)
        a.href = url

        const img = new Image()
        img.src = url
        img.classList.add('generated')
        a.appendChild(img)
        resolve(a)
      }, 'image/jpeg', 0.9)
    })
  }

  const drawHeadline = (ctx, text, x, y) => {
    ctx.save()
    ctx.font = `110px ${CONFIG.FONT}`
    ctx.fillStyle = CONFIG.COLORS.TEXT_PRIMARY
    ctx.textAlign = 'center'
    ctx.fillText(text, x, y)

    const { width } = ctx.measureText(text)
    const padding = 50
    const radiusX = width / 2 + padding
    const radiusY = 110

    ctx.strokeStyle = CONFIG.COLORS.HIGHLIGHT
    ctx.lineWidth = 15
    ctx.beginPath()
    ctx.ellipse(x, y - 40, radiusX, radiusY, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }

  const drawTitleAndAuthor = (ctx, data, startY, maxWidth = 1240) => {
    ctx.save()
    ctx.textAlign = 'left'

    // Title
    ctx.fillStyle = CONFIG.COLORS.TEXT_PRIMARY
    ctx.font = `56px ${CONFIG.FONT}`
    const lines = wrapText(ctx, data.title, maxWidth)
    lines.forEach((line, i) => {
      ctx.fillText(line, 20, startY + i * 56)
    })

    // Author
    ctx.fillStyle = CONFIG.COLORS.TEXT_SECONDARY
    ctx.font = `28px ${CONFIG.FONT}`
    const authorY = startY + (lines.length * 58) - 20
    ctx.fillText(`YouTube: ${data.author_name}`, 20, authorY)

    ctx.restore()
    return lines.length
  }

  // --- Generators ---

  const drawFullImage = (img, data, videoId) => {
    const { canvas, ctx } = createCanvas(CONFIG.CANVAS.WIDTH_FULL, CONFIG.CANVAS.HEIGHT_FULL)

    // Thumbnail with shadow
    ctx.save()
    ctx.shadowColor = CONFIG.COLORS.SHADOW
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    ctx.shadowBlur = 15
    ctx.drawImage(img, 0, (1280 - 720) / 2, 1280, 720)
    ctx.restore()

    // Headline
    drawHeadline(ctx, 'Full Video on YouTube', canvas.width / 2, 170)

    // Metadata
    const titleLineCount = drawTitleAndAuthor(ctx, data, 1100)

    // URL
    ctx.save()
    ctx.fillStyle = '#fff'
    ctx.font = `80px ${CONFIG.FONT}`
    ctx.textAlign = 'center'
    const urlY = 1100 + (titleLineCount * 58) + 110
    ctx.fillText(shortUrl(videoId), canvas.width / 2, urlY)
    ctx.restore()

    return createDownloadLink(`${videoId}-full-image.jpg`, canvas)
  }

  const drawLargeImage = (img, data, videoId) => {
    const { canvas, ctx } = createCanvas(CONFIG.CANVAS.WIDTH_LARGE, CONFIG.CANVAS.HEIGHT_LARGE)

    const imgY = (canvas.height - 720) / 2
    ctx.drawImage(img, 0, imgY, 1280, 720)

    drawHeadline(ctx, 'Full Video on YouTube', canvas.width / 2, 170)
    drawTitleAndAuthor(ctx, data, 1100)

    return createDownloadLink(`${videoId}-large-image.jpg`, canvas)
  }

  const drawBasicImage = (img, data, videoId) => {
    const { canvas, ctx } = createCanvas(CONFIG.CANVAS.WIDTH_BASIC, CONFIG.CANVAS.HEIGHT_BASIC)

    ctx.drawImage(img, 0, 0, 1280, 720)

    drawTitleAndAuthor(ctx, data, 780, 1280 - 40)

    return createDownloadLink(`${videoId}-basic-image.jpg`, canvas)
  }

  const drawBlurredImage = (img, data, videoId) => {
    const { canvas, ctx } = createCanvas(CONFIG.CANVAS.WIDTH_BLUR, CONFIG.CANVAS.HEIGHT_BLUR)

    // Black base
    ctx.fillStyle = CONFIG.COLORS.BG_BLACK
    ctx.fillRect(0, 0, 1280, 720)

    // Blurred thumbnail
    ctx.save()
    ctx.filter = 'blur(10px)'
    ctx.drawImage(img, 0, 0, 1280, 720)
    ctx.restore()

    // Dark Overlay
    ctx.fillStyle = CONFIG.COLORS.OVERLAY
    ctx.fillRect(0, 0, 1280, 720)

    // URL
    ctx.fillStyle = '#fff'
    ctx.font = `80px ${CONFIG.FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(shortUrl(videoId), 1280 / 2, 720 / 2)

    return createDownloadLink(`${videoId}-blurred-image.jpg`, canvas)
  }

  const drawImages = async (img, data, videoId) => {
    els.output?.replaceChildren()

    if (state.isDebug) console.log('Video Data:', data)

    const generators = [
      drawBasicImage,
      drawLargeImage,
      drawFullImage,
      drawBlurredImage,
    ]

    try {
      const links = await Promise.all(generators.map(generate => generate(img, data, videoId)))
      links.forEach(link => els.output.appendChild(link))
    } catch (err) {
      showError(`Error generating images: ${err.message}`)
    }
  }

  // Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

})()
