"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { useTheme } from "next-themes"

interface Node {
  id: string
  x: number
  y: number
  r: number
  name: string
  type: "root" | "subsidiary" | "partner" | "vendor"
  color: string
}

interface Edge {
  source: string
  target: string
  weight: number
}

// Demo data for the network visualization
const DEMO_NODES: Omit<Node, "x" | "y">[] = [
  { id: "root", r: 40, name: "MY ORGANIZATION", type: "root", color: "#ffffff" },
  { id: "sub1", r: 25, name: "Acme Corp", type: "subsidiary", color: "#10b981" },
  { id: "sub2", r: 25, name: "CloudHost Inc", type: "subsidiary", color: "#10b981" },
  { id: "sub3", r: 25, name: "DevTeam LLC", type: "subsidiary", color: "#10b981" },
  { id: "partner1", r: 15, name: "Marketing Pro", type: "partner", color: "#3b82f6" },
  { id: "partner2", r: 15, name: "Legal Services", type: "partner", color: "#3b82f6" },
  { id: "partner3", r: 15, name: "HR Solutions", type: "partner", color: "#3b82f6" },
  { id: "partner4", r: 15, name: "Finance Co", type: "partner", color: "#3b82f6" },
  { id: "vendor1", r: 8, name: "Supplier A", type: "vendor", color: "#71717a" },
  { id: "vendor2", r: 8, name: "Supplier B", type: "vendor", color: "#71717a" },
  { id: "vendor3", r: 6, name: "Supplier C", type: "vendor", color: "#71717a" },
  { id: "vendor4", r: 6, name: "Supplier D", type: "vendor", color: "#71717a" },
  { id: "vendor5", r: 8, name: "Supplier E", type: "vendor", color: "#71717a" },
  { id: "vendor6", r: 6, name: "Supplier F", type: "vendor", color: "#71717a" },
  { id: "vendor7", r: 8, name: "Supplier G", type: "vendor", color: "#71717a" },
  { id: "vendor8", r: 6, name: "Supplier H", type: "vendor", color: "#71717a" },
]

const DEMO_EDGES: Edge[] = [
  { source: "root", target: "sub1", weight: 3 },
  { source: "root", target: "sub2", weight: 3 },
  { source: "root", target: "sub3", weight: 3 },
  { source: "sub1", target: "partner1", weight: 2 },
  { source: "sub1", target: "partner2", weight: 2 },
  { source: "sub2", target: "partner3", weight: 2 },
  { source: "sub3", target: "partner4", weight: 2 },
  { source: "partner1", target: "vendor1", weight: 1 },
  { source: "partner1", target: "vendor2", weight: 1 },
  { source: "partner2", target: "vendor3", weight: 1 },
  { source: "partner3", target: "vendor4", weight: 1 },
  { source: "partner3", target: "vendor5", weight: 1 },
  { source: "partner4", target: "vendor6", weight: 1 },
  { source: "partner4", target: "vendor7", weight: 1 },
  { source: "sub2", target: "vendor8", weight: 1 },
]

export function NetworkGraphDemo() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current
        setDimensions({ width: clientWidth, height: clientHeight })
      }
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  const nodes = useMemo(() => {
    const { width, height } = dimensions
    const centerX = width * 0.5
    const centerY = height * 0.5

    const positioned: Node[] = []

    // Position root at center
    positioned.push({
      ...DEMO_NODES[0],
      x: centerX,
      y: centerY,
    })

    // Position subsidiaries in inner ring
    const subsidiaries = DEMO_NODES.filter((n) => n.type === "subsidiary")
    subsidiaries.forEach((node, i) => {
      const angle = (i / subsidiaries.length) * Math.PI * 2 - Math.PI / 2
      const radius = Math.min(width, height) * 0.22
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    })

    // Position partners in middle ring
    const partners = DEMO_NODES.filter((n) => n.type === "partner")
    partners.forEach((node, i) => {
      const angle = (i / partners.length) * Math.PI * 2 - Math.PI / 4
      const radius = Math.min(width, height) * 0.38
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 20,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 20,
      })
    })

    // Position vendors in outer ring
    const vendors = DEMO_NODES.filter((n) => n.type === "vendor")
    vendors.forEach((node, i) => {
      const angle = (i / vendors.length) * Math.PI * 2
      const radius = Math.min(width, height) * 0.46
      positioned.push({
        ...node,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
      })
    })

    return positioned
  }, [dimensions])

  const getNode = (id: string) => nodes.find((n) => n.id === id)

  return (
    <div
      ref={containerRef}
      className="w-full h-[500px] relative bg-background overflow-hidden"
    >
      <svg width="100%" height="100%" className="cursor-grab">
        <defs>
          <radialGradient id="demo-node-glow">
            <stop offset="0%" stopColor={isDark ? "#fff" : "#000"} stopOpacity="0.8" />
            <stop offset="100%" stopColor={isDark ? "#fff" : "#000"} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="demo-green-glow">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="demo-blue-glow">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Edges */}
        {DEMO_EDGES.map((edge, index) => {
          const sourceNode = getNode(edge.source)
          const targetNode = getNode(edge.target)
          if (!sourceNode || !targetNode) return null

          const isActive = hoveredNode === edge.source || hoveredNode === edge.target
          const edgeColor = isDark
            ? isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"
            : isActive ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.15)"
          const dotColor = isDark
            ? isActive ? "#fff" : "rgba(255,255,255,0.5)"
            : isActive ? "#000" : "rgba(0,0,0,0.5)"

          return (
            <g key={`edge-${index}`} className="pointer-events-none">
              <line
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={edgeColor}
                strokeWidth={isActive ? 1.5 : 0.5}
                className="transition-all duration-300"
              />
              <circle r="2" fill="none" stroke={dotColor} strokeWidth={1}>
                <animateMotion
                  dur={`${2 + (index % 5)}s`}
                  repeatCount="indefinite"
                  path={`M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`}
                />
              </circle>
              {edge.weight > 1 && (
                <circle r="1.5" fill="none" stroke={isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)"} strokeWidth={1}>
                  <animateMotion
                    dur={`${3 + (index % 5)}s`}
                    begin="1s"
                    repeatCount="indefinite"
                    path={`M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`}
                  />
                </circle>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              {/* Glow effects */}
              {node.type === "subsidiary" && (
                <circle cx={0} cy={0} r={node.r * 2.5} fill="url(#demo-green-glow)" opacity="0.5" />
              )}
              {node.type === "partner" && isHovered && (
                <circle cx={0} cy={0} r={node.r * 2.5} fill="url(#demo-blue-glow)" opacity="0.4" />
              )}
              {isHovered && (
                <circle cx={0} cy={0} r={node.r * 2} fill="url(#demo-node-glow)" opacity="0.4" />
              )}

              {/* Main circle */}
              <circle
                cx={0}
                cy={0}
                r={node.r}
                fill={isDark ? "#0a0a0a" : "#ffffff"}
                stroke={node.color}
                strokeWidth={node.type === "vendor" ? 1 : 2}
                className="transition-all duration-300"
              />

              {/* Inner ring for subsidiaries */}
              {node.type === "subsidiary" && (
                <circle
                  cx={0}
                  cy={0}
                  r={node.r - 4}
                  fill="none"
                  stroke={node.color}
                  strokeWidth={1}
                  opacity={0.5}
                />
              )}

              {/* Label */}
              {(node.r > 8 || isHovered) && (
                <text
                  x={0}
                  y={node.r + 14}
                  textAnchor="middle"
                  fill={isHovered ? (isDark ? "#fff" : "#000") : "#71717a"}
                  className="text-[10px] font-mono tracking-wider font-medium pointer-events-none select-none uppercase"
                >
                  {node.name}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-white border-2 border-white"></div>
          <span className="text-[10px] text-muted-foreground font-mono uppercase">Organization</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-emerald-500"></div>
          <span className="text-[10px] text-emerald-500 font-mono uppercase">Subsidiaries</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-blue-500"></div>
          <span className="text-[10px] text-blue-500 font-mono uppercase">Partners</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-zinc-500"></div>
          <span className="text-[10px] text-zinc-500 font-mono uppercase">Vendors</span>
        </div>
      </div>

      {/* Title */}
      <div className="absolute top-4 right-4 text-right pointer-events-none">
        <h3 className="text-lg font-bold text-foreground tracking-tight">Payment Network</h3>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">LIVE TOPOLOGY</p>
      </div>
    </div>
  )
}
