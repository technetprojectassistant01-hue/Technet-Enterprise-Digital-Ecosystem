export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => reject(new Error(err.message || 'Unable to determine your location')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })
}

export function mapLink(lat: string, lng: string) {
  return `https://www.google.com/maps?q=${lat},${lng}`
}
