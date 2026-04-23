let _hubUrl: string = ''

export function getHubUrl(): string {
  return _hubUrl
}

export function setHubUrl(url: string) {
  _hubUrl = url.replace(/\/$/, '') // strip trailing slash
}
