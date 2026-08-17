import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname

  // A landing comercial passa a ser a home pública sem duplicar o produto.
  if (pathname === '/') {
    // Rewrite interno usado por /app para renderizar o produto atual.
    if (url.searchParams.get('__lotosmart_product') === '1') {
      url.searchParams.delete('__lotosmart_product')
      return NextResponse.next()
    }

    url.pathname = '/landing'
    return NextResponse.rewrite(url)
  }

  // Mantém a aplicação existente em /app sem mover centenas de linhas
  // nesta fase. O navegador continua exibindo /app.
  if (pathname === '/app' || pathname === '/app/') {
    url.pathname = '/'
    url.searchParams.set('__lotosmart_product', '1')
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/app', '/app/'],
}
