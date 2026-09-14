import { getT } from '../i18n'

/** Thrown when the phone or browser refuses location — the check-in card shows the "blocked" dialog. */
export class LocationDeniedError extends Error {}

export type LocationPermission = 'granted' | 'prompt' | 'denied' | 'unknown'

/**
 * What the browser will do if we ask for location now. 'unknown' where the Permissions API isn't
 * available (older iPhones) — then the only way to find out is to ask.
 */
export async function locationPermission(): Promise<LocationPermission> {
  try {
    if (!navigator.permissions?.query) return 'unknown'
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state as LocationPermission
  } catch {
    return 'unknown'
  }
}

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
      if (denied) throw new LocationDeniedError(getT().geo.denied)
      throw new Error(getT().geo.unavailable)
    }
  }
}

export function mapLink(lat: string, lng: string) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
