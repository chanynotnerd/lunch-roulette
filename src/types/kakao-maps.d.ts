/**
 * 카카오맵 JavaScript SDK 중 이 앱이 쓰는 것만 선언한다. 스펙 16 M6.
 * 타입 패키지를 깔지 않는다. 여기 없는 API를 쓰려면 이 파일에 먼저 추가한다.
 * SDK는 autoload=false로 넣고 kakao.maps.load(콜백) 안에서만 Map 등을 만든다.
 */

export type KakaoLatLng = {
  getLat(): number
  getLng(): number
}

export type KakaoLatLngBounds = {
  extend(point: KakaoLatLng): void
}

export type KakaoMapInstance = {
  setCenter(point: KakaoLatLng): void
  setLevel(level: number): void
  panTo(point: KakaoLatLng): void
  setBounds(
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void
  relayout(): void
}

export type KakaoOverlay = {
  setMap(map: KakaoMapInstance | null): void
  setZIndex(zIndex: number): void
}

export type KakaoOverlayOptions = {
  position: KakaoLatLng
  content: HTMLElement | string
  xAnchor?: number
  yAnchor?: number
  zIndex?: number
  /** true면 오버레이 탭이 지도 click 이벤트로 번지지 않는다. */
  clickable?: boolean
}

export type KakaoMapsNamespace = {
  load(callback: () => void): void
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMapInstance
  LatLng: new (lat: number, lng: number) => KakaoLatLng
  LatLngBounds: new () => KakaoLatLngBounds
  CustomOverlay: new (options: KakaoOverlayOptions) => KakaoOverlay
  event: {
    addListener(target: object, type: string, handler: (...args: unknown[]) => void): void
  }
}

declare global {
  interface Window {
    kakao?: { maps?: KakaoMapsNamespace }
  }
}
