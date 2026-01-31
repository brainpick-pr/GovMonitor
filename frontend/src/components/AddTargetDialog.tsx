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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  const [interval, setInterval] = useState("15")
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
        Number(interval),
        state,
        checkMode,
        expectedStatus,
        jsonPath || undefined,
        expectedJsonValue || undefined,
        textMatch || undefined
      )
      setName("")
      setUrl("")
      setInterval("15")
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
              <Label>Check Interval</Label>
              <Select value={interval} onValueChange={setInterval}>
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>State / UT</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a state" />
                </SelectTrigger>
                <SelectContent>
                  {indianStates.map((stateName) => (
                    <SelectItem key={stateName} value={stateName}>
                      {stateName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Check Type</Label>
              <Select value={checkMode} onValueChange={(v) => setCheckMode(v as CheckMode)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select check type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website (HTTP status check)</SelectItem>
                  <SelectItem value="api-json">API JSON (validate JSON response)</SelectItem>
                  <SelectItem value="api-text">API Text (substring match)</SelectItem>
                </SelectContent>
              </Select>
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
