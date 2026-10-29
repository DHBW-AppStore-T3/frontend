import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { createAppRouter } from '@/router'

/** Application root: provides the router (layouts, guards and the Toast host live in its route tree). */
export default function App() {
  // One router per mounted app; created lazily so tests can mount without a browser history.
  const [router] = useState(createAppRouter)
  return <RouterProvider router={router} />
}
