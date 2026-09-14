param(
  [string]$SourcePath = "assets/img/logo-open-tennis.png"
)

Add-Type -AssemblyName System.Drawing

$resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
$source = [System.Drawing.Bitmap]::FromFile($resolvedSource)

try {
  $minX = $source.Width
  $minY = $source.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $source.Height; $y++) {
    for ($x = 0; $x -lt $source.Width; $x++) {
      if ($source.GetPixel($x, $y).A -ge 240) {
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt $minX -or $maxY -lt $minY) {
    throw "El logo de origen no contiene pixeles visibles."
  }

  $visibleWidth = $maxX - $minX + 1
  $visibleHeight = $maxY - $minY + 1
  $cropSize = [Math]::Max($visibleWidth, $visibleHeight)
  $centerX = ($minX + $maxX) / 2
  $centerY = ($minY + $maxY) / 2
  $cropX = [Math]::Round($centerX - ($cropSize / 2))
  $cropY = [Math]::Round($centerY - ($cropSize / 2))
  $sourceRect = [System.Drawing.Rectangle]::new($cropX, $cropY, $cropSize, $cropSize)

  function Write-PwaIcon {
    param(
      [int]$Size,
      [double]$LogoRatio,
      [string]$OutputPath,
      [bool]$OpaqueBackground
    )

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

    try {
      $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

      if ($OpaqueBackground) {
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#0b2f25"))
      } else {
        $graphics.Clear([System.Drawing.Color]::Transparent)
      }

      $logoSize = [Math]::Round($Size * $LogoRatio)
      $offset = [Math]::Round(($Size - $logoSize) / 2)
      $destinationRect = [System.Drawing.Rectangle]::new($offset, $offset, $logoSize, $logoSize)
      $graphics.DrawImage($source, $destinationRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)

      $fullOutputPath = Join-Path (Get-Location) $OutputPath
      $bitmap.Save($fullOutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }

  Write-PwaIcon -Size 512 -LogoRatio 0.86 -OutputPath "assets/icons/icon-512.png" -OpaqueBackground $false
  Write-PwaIcon -Size 192 -LogoRatio 0.86 -OutputPath "assets/icons/icon-192.png" -OpaqueBackground $false
  Write-PwaIcon -Size 512 -LogoRatio 0.72 -OutputPath "assets/icons/icon-maskable-512.png" -OpaqueBackground $true
  Write-PwaIcon -Size 192 -LogoRatio 0.72 -OutputPath "assets/icons/icon-maskable-192.png" -OpaqueBackground $true
} finally {
  $source.Dispose()
}
