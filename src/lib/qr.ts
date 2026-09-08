import QRCode from 'qrcode'

export interface QrOptions {
  darkColor?: string
  lightColor?: string
  margin?: number
  width?: number
}

/**
 * Generate a 100% ISO/IEC 18004 compliant SVG QR Code.
 * Compatible with all iOS Camera, Android, and Google Lens QR scanners.
 */
export async function generateQrSvg(text: string, options?: QrOptions): Promise<string> {
  const dark = options?.darkColor || '#050811'
  const light = options?.lightColor || '#ffffff'
  const margin = options?.margin !== undefined ? options.margin : 2

  return await QRCode.toString(text, {
    type: 'svg',
    margin,
    color: {
      dark,
      light
    }
  })
}

/**
 * Generate a PNG Data URL QR code for display in an <img> tag.
 */
export async function generateQrDataUrl(text: string, options?: QrOptions): Promise<string> {
  const dark = options?.darkColor || '#050811'
  const light = options?.lightColor || '#ffffff'
  const margin = options?.margin !== undefined ? options.margin : 2
  const width = options?.width || 320

  return await QRCode.toDataURL(text, {
    margin,
    width,
    color: {
      dark,
      light
    }
  })
}
