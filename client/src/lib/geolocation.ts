import { getT } from '../i18n'

function requestPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export async function getPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    throw new Error(getT().geo.unsupported)
  }
  try {
    return await requestPosition({ enableHighAccuracy: true, timeout: 15000 })
  } catch {
    // A precise GPS fix can take longer than 15s indoors or under cover — retry once with a
    // coarser, network-based location rather than failing the check-in outright.
    try {
      return await requestPosition({ enableHighAccuracy: false, timeout: 10000 })
    } catch (err) {
      // The browser's own message is English-only and cryptic ("User denied Geolocation"), so map
      // the error code to our own wording — a blocked permission needs a different fix than a
      // weak signal.
      const denied = err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED
      throw new Error(denied ? getT().geo.denied : getT().geo.unavailable)
    }
  }
}

export function mapLink(lat: string, lng: string) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
