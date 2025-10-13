import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type CheckMode = 'website' | 'api-json' | 'api-text';

interface AddTargetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (
    name: string,
    url: string,
    interval: number,
    state: string,
    checkMode: CheckMode,
    expectedStatus: number,
    jsonPath?: string,
    expectedJsonValue?: string,
    textMatch?: string
  ) => Promise<void>
}

export function AddTargetDialog({
  open,
  onOpenChange,
  onAdd,
}: AddTargetDialogProps) {
  const indianStates = useMemo(
    () => [
      "Andhra Pradesh",
      "Arunachal Pradesh",
      "Assam",
      "Bihar",
      "Chhattisgarh",
      "Goa",
      "Gujarat",
      "Haryana",
      "Himachal Pradesh",
      "Jharkhand",
      "Karnataka",
      "Kerala",
      "Madhya Pradesh",
      "Maharashtra",
      "Manipur",
      "Meghalaya",
      "Mizoram",
      "Nagaland",
      "Odisha",
      "Punjab",
      "Rajasthan",
      "Sikkim",
      "Tamil Nadu",
      "Telangana",
      "Tripura",
      "Uttar Pradesh",
      "Uttarakhand",
      "West Bengal",
      "Andaman and Nicobar Islands",
      "Chandigarh",
      "Dadra and Nagar Haveli and Daman and Diu",
      "Delhi",
      "Jammu and Kashmir",
      "Ladakh",
      "Lakshadweep",
      "Puducherry",
    ],
    []
  )

  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [interval, setInterval] = useState(15)
  const [state, setState] = useState("")
  const [checkMode, setCheckMode] = useState<CheckMode>("website")
  const [expectedStatus, setExpectedStatus] = useState(200)
  const [jsonPath, setJsonPath] = useState("")
  const [expectedJsonValue, setExpectedJsonValue] = useState("")
  const [textMatch, setTextMatch] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!state) {
      setError("Please select a state")
      return
    }

    if (checkMode === "api-json" && (!jsonPath || !expectedJsonValue)) {
      setError("JSON path and expected value are required for API JSON checks")
      return
    }

    if (checkMode === "api-text" && !textMatch) {
      setError("Text match is required for API text checks")
      return
    }

    setLoading(true)

    try {
      await onAdd(
        name,
        url,
        interval,
        state,
        checkMode,
        expectedStatus,
        jsonPath || undefined,
        expectedJsonValue || undefined,
        textMatch || undefined
      )
      setName("")
      setUrl("")
      setInterval(15)
      setState("")
      setCheckMode("website")
      setExpectedStatus(200)
      setJsonPath("")
      setExpectedJsonValue("")
      setTextMatch("")
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Government Website</DialogTitle>
            <DialogDescription>
              Add a government website to monitor. Only .gov, .gov.*, .gc.ca,
              and .government.* domains are allowed.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., White House"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://www.whitehouse.gov"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="interval">Check Interval (minutes)</Label>
              <select
                id="interval"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="state">State / UT</Label>
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="">Select a state</option>
                {indianStates.map((stateName) => (
                  <option key={stateName} value={stateName}>
                    {stateName}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="checkMode">Check Type</Label>
              <select
                id="checkMode"
                value={checkMode}
                onChange={(e) => setCheckMode(e.target.value as CheckMode)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="website">Website (HTTP status check)</option>
                <option value="api-json">API JSON (validate JSON response)</option>
                <option value="api-text">API Text (substring match)</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="expectedStatus">Expected HTTP Status</Label>
              <Input
                id="expectedStatus"
                type="number"
                value={expectedStatus}
                onChange={(e) => setExpectedStatus(Number(e.target.value))}
                min={100}
                max={599}
              />
            </div>

            {checkMode === "api-json" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="jsonPath">JSON Path</Label>
                  <Input
                    id="jsonPath"
                    placeholder="e.g., status.health"
                    value={jsonPath}
                    onChange={(e) => setJsonPath(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Dot-separated path to the field to validate
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="expectedJsonValue">Expected JSON Value</Label>
                  <Input
                    id="expectedJsonValue"
                    placeholder="e.g., ok"
                    value={expectedJsonValue}
                    onChange={(e) => setExpectedJsonValue(e.target.value)}
                  />
                </div>
              </>
            )}

            {checkMode === "api-text" && (
              <div className="grid gap-2">
                <Label htmlFor="textMatch">Text to Match</Label>
                <Input
                  id="textMatch"
                  placeholder="e.g., success"
                  value={textMatch}
                  onChange={(e) => setTextMatch(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Substring that must appear in the response
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Website"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
