import { prisma } from "@/lib/prisma"

export type AlertType = "error" | "warning" | "info" | "critical"
export type ServiceType = "payment" | "auth" | "database" | "api" | "security" | "integration"

interface MonitoringEvent {
  alertType: AlertType
  service: ServiceType
  message: string
  details?: Record<string, any>
}

/**
 * Log a monitoring alert to the database
 */
export async function logMonitoringAlert(event: MonitoringEvent): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO monitoring_alerts (alert_type, service, message, details, is_resolved)
       VALUES ($1, $2, $3, $4, $5)`,
      event.alertType,
      event.service,
      event.message,
      JSON.stringify(event.details || {}),
      false,
    )
  } catch (error) {
    console.error("[Monitoring] Failed to log alert:", error)
  }
}

/**
 * Log a security alert
 */
export async function logSecurityAlert(
  alertType: string,
  severity: "low" | "medium" | "high" | "critical",
  actor: string,
  description: string,
  details?: Record<string, any>,
): Promise<void> {
  try {
    await prisma.securityAlert.create({
      data: {
        alert_type: alertType,
        severity,
        address: actor,
        description,
        details: details || {},
      },
    })
  } catch (error) {
    console.error("[Monitoring] Failed to log security alert:", error)
  }
}

/**
 * Check system health and log any issues
 */
export async function checkSystemHealth(): Promise<{
  healthy: boolean
  issues: string[]
}> {
  const issues: string[] = []

  // Check database connection
  try {
    const response = await fetch('/api/health');
    if (!response.ok) {
      issues.push("Database/System health check failed");
    }
  } catch (error) {
    issues.push("Health check endpoint unreachable");
  }

  // Check required environment variables
  const requiredEnvVars = ["DATABASE_URL", "NEXT_PUBLIC_REOWN_PROJECT_ID"]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      issues.push(`Missing environment variable: ${envVar}`)
    }
  }

  return {
    healthy: issues.length === 0,
    issues,
  }
}

/**
 * Get unresolved alert counts
 */
export async function getAlertCounts(): Promise<{
  security: number
  system: number
  total: number
}> {
  try {
    const securityCount = await prisma.securityAlert.count()

    const systemResult: { count: bigint }[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM monitoring_alerts WHERE is_resolved = false`,
    )
    const systemCount = Number(systemResult[0]?.count || 0)

    return {
      security: securityCount,
      system: systemCount,
      total: securityCount + systemCount,
    }
  } catch (error) {
    return { security: 0, system: 0, total: 0 }
  }
}
