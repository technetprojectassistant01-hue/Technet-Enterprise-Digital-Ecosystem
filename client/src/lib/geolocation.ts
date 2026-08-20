function requestPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export async function getPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported by this browser')
  }
  try {
    return await requestPosition({ enableHighAccuracy: true, timeout: 15000 })
  } catch {
    // A precise GPS fix can take longer than 15s indoors or under cover — retry once with a
    // coarser, network-based location rather than failing the check-in outright.
    try {
      return await requestPosition({ enableHighAccuracy: false, timeout: 10000 })
    } catch (err) {
      const message = err instanceof GeolocationPositionError ? err.message : undefined
      throw new Error(message || 'Unable to determine your location. Move outdoors or near a window and try again.')
    }
  }
}

export function mapLink(lat: string, lng: string) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
