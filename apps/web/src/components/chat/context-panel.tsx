interface ContextPanelProps {
  workspace: {
    axe_type: string
    metadata: Record<string, unknown> | null
  }
}

const axeLabels: Record<string, string> = {
  tresorerie: 'Trésorerie',
  growth: 'Growth',
  admin: 'Admin',
}

export function ContextPanel({ workspace }: ContextPanelProps) {
  const metadata = workspace.metadata ?? {}
  const qonto = metadata.qonto as Record<string, unknown> | undefined
  const otherKeys = Object.keys(metadata).filter((k) => k !== 'qonto')

  return (
    <div className="flex h-full w-72 flex-col border-l border-gray-800 bg-gray-950 p-4">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">Contexte</h3>

      <div className="mb-4">
        <span className="inline-block rounded-full bg-gray-800 px-3 py-1 text-xs font-medium text-gray-200">
          {axeLabels[workspace.axe_type] ?? workspace.axe_type}
        </span>
      </div>

      {qonto && (
        <div className="mb-4 rounded-lg border border-gray-800 p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-400">Qonto</h4>
          <div className="space-y-1 text-xs text-gray-300">
            {Object.entries(qonto).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-500">{key}</span>
                <span className="truncate ml-2">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {otherKeys.length > 0 && (
        <div className="rounded-lg border border-gray-800 p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-400">Metadata</h4>
          <div className="space-y-1 text-xs text-gray-300">
            {otherKeys.map((key) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-500">{key}</span>
                <span className="truncate ml-2">{String(metadata[key])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
