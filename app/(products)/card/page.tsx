"use client"

import type React from "react"

import { useState, useRef } from "react"
import Image from "next/image"
import { useUnifiedWallet } from "@/hooks/use-unified-wallet"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  CreditCard,
  Shield,
  Globe,
  Zap,
  Check,
  ArrowRight,
  Smartphone,
  Lock,
  ChevronRight,
  Sparkles,
  Eye,
  EyeOff,
  Snowflake,
  RefreshCw,
} from "lucide-react"

type CardType = "virtual" | "physical"
type CardStatus = "none" | "pending" | "active" | "frozen"

interface UserCard {
  id: string
  type: CardType
  status: CardStatus
  last4: string
  expiryMonth: string
  expiryYear: string
  cvv: string
  balance: number
  spendLimit: number
  cardholderName: string
}

function LiquidMetalCard({
  userCard,
  showDetails,
  isFlipped,
  onFlip,
}: {
  userCard: UserCard | null
  showDetails: boolean
  isFlipped: boolean
  onFlip: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setMousePosition({ x, y })
  }

  const handleMouseEnter = () => setIsHovering(true)
  const handleMouseLeave = () => {
    setIsHovering(false)
    setMousePosition({ x: 0.5, y: 0.5 })
  }

  const rotateX = isHovering ? (mousePosition.y - 0.5) * -20 : 0
  const rotateY = isHovering ? (mousePosition.x - 0.5) * 20 : 0
  const lightX = mousePosition.x * 100
  const lightY = mousePosition.y * 100

  return (
    <div className="cursor-pointer" style={{ perspective: "1000px" }} onClick={onFlip}>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative w-[420px] h-[265px] transition-all duration-500 ease-out"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotateX}deg) rotateY(${isFlipped ? 180 + rotateY : rotateY}deg)`,
        }}
      >
        {/* Front — frosted glass */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden" style={{ backfaceVisibility: "hidden" }}>
          {/* Glass base — semi-transparent dark with blur */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.06) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
          />

          {/* Subtle noise texture */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Moving light reflection */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: isHovering ? 0.6 : 0.2,
              background: `radial-gradient(
                ellipse 60% 40% at ${lightX}% ${lightY}%,
                rgba(255,255,255,0.15) 0%,
                transparent 60%
              )`,
            }}
          />

          {/* Edge highlight */}
          <div
            className="absolute inset-0 rounded-3xl transition-opacity duration-300"
            style={{
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: isHovering
                ? "inset 0 0 40px rgba(255,255,255,0.04), 0 8px 60px rgba(99,102,241,0.12)"
                : "inset 0 0 20px rgba(255,255,255,0.02)",
            }}
          />

          {/* Card content — logo only + Mastercard outline */}
          <div className="relative h-full p-8 flex flex-col justify-between z-10">
            {/* Logo — top left */}
            <div className="flex items-start">
              <Image
                src="/logo-text-white.png"
                alt="Protocol Banks"
                width={160}
                height={40}
                className="opacity-80"
                style={{ objectFit: "contain", objectPosition: "left" }}
              />
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Bottom row — Mastercard outline, bottom right */}
            <div className="flex justify-end items-end">
              <svg width="56" height="36" viewBox="0 0 56 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Left circle */}
                <circle cx="20" cy="18" r="14" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" />
                {/* Right circle */}
                <circle cx="36" cy="18" r="14" stroke="rgba(255,255,255,0.3)" strokeWidth="1.2" fill="none" />
              </svg>
            </div>
          </div>
        </div>

        {/* Back — frosted glass */}
        <div
          className="absolute inset-0 rounded-3xl overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {/* Glass base */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.08) 100%)",
              backdropFilter: "blur(40px)",
              WebkitBackdropFilter: "blur(40px)",
            }}
          />

          {/* Moving light */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: isHovering ? 0.4 : 0.15,
              background: `radial-gradient(
                ellipse 60% 40% at ${100 - lightX}% ${lightY}%,
                rgba(255,255,255,0.12) 0%,
                transparent 60%
              )`,
            }}
          />

          {/* Border */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{ border: "1px solid rgba(255,255,255,0.12)" }}
          />

          <div className="relative h-full flex flex-col z-10">
            {/* Magnetic stripe */}
            <div className="w-full h-12 bg-white/[0.06] mt-8 border-y border-white/[0.08]" />

            <div className="flex-1 px-8 py-5 flex flex-col justify-between">
              {/* Signature + CVV */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-10 bg-white/[0.06] rounded border border-white/[0.08] flex items-center px-4">
                  <span className="text-white/20 italic text-sm">
                    {userCard?.cardholderName || "Authorized Signature"}
                  </span>
                </div>
                <div className="bg-white/[0.08] rounded border border-white/[0.08] px-4 py-1.5">
                  <div className="text-[8px] text-white/30 uppercase">CVV</div>
                  <div className="font-mono text-lg text-white/60 font-bold">
                    {showDetails ? userCard?.cvv || "742" : "•••"}
                  </div>
                </div>
              </div>

              {/* Fine print */}
              <div className="text-[9px] text-white/15 leading-relaxed">
                This card is property of Protocol Banks. Use subject to the cardholder agreement.
              </div>

              {/* Bottom — logo + Mastercard */}
              <div className="flex justify-between items-center">
                <Image
                  src="/logo-text-white.png"
                  alt="Protocol Banks"
                  width={100}
                  height={24}
                  className="opacity-40"
                  style={{ objectFit: "contain", objectPosition: "left" }}
                />
                <svg width="42" height="28" viewBox="0 0 56 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="20" cy="18" r="14" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
                  <circle cx="36" cy="18" r="14" stroke="rgba(255,255,255,0.2)" strokeWidth="1" fill="none" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-4 text-xs text-muted-foreground">Click card to flip • Hover for 3D effect</div>
    </div>
  )
}

export default function CardPage() {
  const { isConnected, address: wallet } = useUnifiedWallet()
  const [activeTab, setActiveTab] = useState<"overview" | "apply" | "manage">("overview")
  const [cardType, setCardType] = useState<CardType>("virtual")
  const [isApplying, setIsApplying] = useState(false)
  const [showCardDetails, setShowCardDetails] = useState(false)
  const [isCardFlipped, setIsCardFlipped] = useState(false)
  const [applicationStep, setApplicationStep] = useState(1)

  const [userCard, setUserCard] = useState<UserCard | null>({
    id: "card_demo_001",
    type: "virtual",
    status: "active",
    last4: "4289",
    expiryMonth: "12",
    expiryYear: "28",
    cvv: "742",
    balance: 2450.0,
    spendLimit: 10000,
    cardholderName: "TEST USER",
  })

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    address: "",
    city: "",
    postalCode: "",
  })

  const handleApply = async () => {
    setIsApplying(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setUserCard({
      id: `card_${Date.now()}`,
      type: cardType,
      status: "active",
      last4: Math.floor(1000 + Math.random() * 9000).toString(),
      expiryMonth: "12",
      expiryYear: "28",
      cvv: Math.floor(100 + Math.random() * 900).toString(),
      balance: 0,
      spendLimit: cardType === "virtual" ? 5000 : 25000,
      cardholderName: formData.fullName.toUpperCase() || "CARDHOLDER",
    })
    setIsApplying(false)
    setActiveTab("manage")
  }

  const toggleCardFreeze = () => {
    if (userCard) {
      setUserCard({
        ...userCard,
        status: userCard.status === "frozen" ? "active" : "frozen",
      })
    }
  }

  const features = [
    {
      icon: Globe,
      title: "Global Acceptance",
      description: "Spend at 150M+ merchants worldwide with Visa/Mastercard network",
    },
    {
      icon: Zap,
      title: "Instant Funding",
      description: "Top up instantly from your USDC, USDT, or DAI balance",
    },
    {
      icon: Shield,
      title: "Non-Custodial Security",
      description: "Your crypto stays in your wallet until you spend",
    },
    {
      icon: Lock,
      title: "Advanced Controls",
      description: "Set spending limits, freeze/unfreeze, and real-time alerts",
    },
  ]

  const cardBenefits = {
    virtual: [
      "Instant issuance - use within seconds",
      "Perfect for online purchases",
      "No physical card to lose",
      "$5,000 monthly limit",
      "Free to issue",
    ],
    physical: [
      "Premium metal card design",
      "ATM withdrawals worldwide",
      "Contactless payments (NFC)",
      "$25,000 monthly limit",
      "Free shipping globally",
    ],
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-[#0a0a1a]" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
          {/* Floating orbs - indigo/violet theme */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                <Sparkles className="w-3 h-3 mr-1" />
                Next-Gen Digital Banking
              </Badge>

              <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                Your Crypto,
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary via-violet-400 to-purple-400">
                  Glass Card
                </span>
              </h1>

              <p className="text-xl text-muted-foreground max-w-lg leading-relaxed">
                Experience the future of payments. A transparent card that converts your stablecoins to any currency
                instantly at point of sale.
              </p>

              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={() => setActiveTab("apply")}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/20"
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Get Your Card
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border bg-card/50 backdrop-blur-sm text-lg px-8 py-6 rounded-xl hover:bg-card"
                >
                  Learn More
                </Button>
              </div>

              {/* Stats - updated colors */}
              <div className="flex gap-12 pt-6">
                <div>
                  <div className="text-3xl font-bold text-primary">150M+</div>
                  <div className="text-sm text-muted-foreground">Merchants</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-violet-400">150+</div>
                  <div className="text-sm text-muted-foreground">Countries</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-purple-400">0%</div>
                  <div className="text-sm text-muted-foreground">FX Markup</div>
                </div>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <LiquidMetalCard
                userCard={userCard}
                showDetails={showCardDetails}
                isFlipped={isCardFlipped}
                onFlip={() => setIsCardFlipped(!isCardFlipped)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="apply">Apply</TabsTrigger>
            <TabsTrigger value="manage" disabled={!userCard}>
              Manage
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab - updated colors */}
          <TabsContent value="overview" className="space-y-8">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="bg-card/50 border-border hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardHeader>
                    <feature.icon className="w-10 h-10 text-primary mb-2" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Card Types */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card
                className={`cursor-pointer transition-all ${
                  cardType === "virtual" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
                onClick={() => setCardType("virtual")}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5" />
                        Virtual Card
                      </CardTitle>
                      <CardDescription>Instant digital card</CardDescription>
                    </div>
                    {cardType === "virtual" && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {cardBenefits.virtual.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all ${
                  cardType === "physical" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
                onClick={() => setCardType("physical")}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Physical Card
                      </CardTitle>
                      <CardDescription>Premium metal card</CardDescription>
                    </div>
                    {cardType === "physical" && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {cardBenefits.physical.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-center">
              <Button size="lg" onClick={() => setActiveTab("apply")} className="bg-primary hover:bg-primary/90">
                Continue to Application
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </TabsContent>

          {/* Apply Tab */}
          <TabsContent value="apply" className="max-w-2xl mx-auto">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Apply for {cardType === "virtual" ? "Virtual" : "Physical"} Card</CardTitle>
                <CardDescription>Complete your application in 2 simple steps</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Progress indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      applicationStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    1
                  </div>
                  <div className={`flex-1 h-1 ${applicationStep >= 2 ? "bg-primary" : "bg-muted"}`} />
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      applicationStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    2
                  </div>
                </div>

                {applicationStep === 1 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                          id="fullName"
                          placeholder="John Doe"
                          value={formData.fullName}
                          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="john@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="+1 (555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <Button onClick={() => setApplicationStep(2)} className="w-full bg-primary hover:bg-primary/90">
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {applicationStep === 2 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        placeholder="United States"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Street Address</Label>
                      <Input
                        id="address"
                        placeholder="123 Main St"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="bg-background"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          placeholder="New York"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input
                          id="postalCode"
                          placeholder="10001"
                          value={formData.postalCode}
                          onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                          className="bg-background"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Button variant="outline" onClick={() => setApplicationStep(1)} className="flex-1">
                        Back
                      </Button>
                      <Button
                        onClick={handleApply}
                        disabled={isApplying}
                        className="flex-1 bg-primary hover:bg-primary/90"
                      >
                        {isApplying ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Submit Application
                            <Check className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-6">
            {userCard && (
              <>
                {/* Card Preview */}
                <div className="flex justify-center mb-8">
                  <LiquidMetalCard
                    userCard={userCard}
                    showDetails={showCardDetails}
                    isFlipped={isCardFlipped}
                    onFlip={() => setIsCardFlipped(!isCardFlipped)}
                  />
                </div>

                {/* Card Controls */}
                <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Available Balance</div>
                        <div className="text-3xl font-bold">${userCard.balance.toLocaleString()}</div>
                        <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                          <Plus className="mr-2 h-4 w-4" />
                          Add Funds
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Card Status</div>
                        <Badge
                          variant={userCard.status === "active" ? "default" : "secondary"}
                          className={
                            userCard.status === "active"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-amber-500/10 text-amber-500"
                          }
                        >
                          {userCard.status === "active" ? "Active" : "Frozen"}
                        </Badge>
                        <Button
                          variant={userCard.status === "frozen" ? "default" : "outline"}
                          size="sm"
                          onClick={toggleCardFreeze}
                          className="mt-2"
                        >
                          <Snowflake className="mr-2 h-4 w-4" />
                          {userCard.status === "frozen" ? "Unfreeze" : "Freeze"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <div className="text-sm text-muted-foreground">Card Details</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCardDetails(!showCardDetails)}
                          className="mt-2"
                        >
                          {showCardDetails ? (
                            <>
                              <EyeOff className="mr-2 h-4 w-4" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Show Details
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Transactions */}
                <Card className="max-w-3xl mx-auto bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { merchant: "Amazon", amount: -156.99, date: "Today", category: "Shopping" },
                        { merchant: "Starbucks", amount: -8.5, date: "Yesterday", category: "Food & Drink" },
                        { merchant: "Uber", amount: -24.0, date: "Dec 26", category: "Transport" },
                        { merchant: "Card Top-up", amount: 500.0, date: "Dec 25", category: "Deposit" },
                      ].map((tx, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center py-3 border-b border-border last:border-0"
                        >
                          <div>
                            <div className="font-medium">{tx.merchant}</div>
                            <div className="text-sm text-muted-foreground">
                              {tx.date} • {tx.category}
                            </div>
                          </div>
                          <div className={`font-mono font-medium ${tx.amount > 0 ? "text-emerald-500" : ""}`}>
                            {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

// Missing Plus icon import fix
function Plus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}
