import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RouterProvider } from 'react-router'
import { AppErrorBoundary } from '@/components/feedback/ErrorBoundary'
import { UpdatePrompt } from '@/components/feedback/UpdatePrompt'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { router } from './router'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

export function App() {
  const [queryClient] = useState(createQueryClient)
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider delayDuration={300}>
              <RouterProvider router={router} />
              <UpdatePrompt />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}
