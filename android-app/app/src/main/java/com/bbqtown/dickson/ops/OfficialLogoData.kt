package com.bbqtown.dickson.ops

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val LogoGold = Color(0xFFD5A05C)
private val LogoRed = Color(0xFFB82025)
private val LogoInk = Color(0xFF161616)

@Composable
internal fun OfficialBbqTownLogo(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier = modifier, contentAlignment = Alignment.Center) {
        val compact = maxWidth < 160.dp || maxHeight < 60.dp
        val titleSize = if (compact) 17.sp else 38.sp
        val ringSize = if (compact) 23.dp else 48.dp
        val subtitleSize = if (compact) 0.sp else 8.sp
        val gap = if (compact) 2.dp else 4.dp

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "BBQ T",
                    color = LogoGold,
                    fontSize = titleSize,
                    fontWeight = FontWeight.Black,
                    letterSpacing = if (compact) (-0.5).sp else (-1.2).sp
                )
                Spacer(Modifier.width(gap))
                FlameO(Modifier.size(ringSize))
                Spacer(Modifier.width(gap))
                Text(
                    text = "WN",
                    color = LogoGold,
                    fontSize = titleSize,
                    fontWeight = FontWeight.Black,
                    letterSpacing = if (compact) (-0.5).sp else (-1.2).sp
                )
            }

            if (!compact) {
                Spacer(Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("뷔", color = LogoRed, fontWeight = FontWeight.Black, fontSize = 12.sp)
                    Spacer(Modifier.width(6.dp))
                    Text("•", color = LogoInk, fontSize = 8.sp)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "KOREAN BBQ BUFFET",
                        color = LogoInk,
                        fontWeight = FontWeight.Bold,
                        fontSize = subtitleSize,
                        letterSpacing = 0.9.sp,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("•", color = LogoInk, fontSize = 8.sp)
                    Spacer(Modifier.width(6.dp))
                    Text("페", color = LogoRed, fontWeight = FontWeight.Black, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun FlameO(modifier: Modifier = Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = (size.minDimension * 0.13f).coerceAtLeast(2f)
            drawCircle(
                color = LogoGold,
                radius = size.minDimension * 0.40f,
                center = center,
                style = Stroke(width = stroke)
            )

            val w = size.width
            val h = size.height
            val outer = Path().apply {
                moveTo(w * 0.52f, h * 0.16f)
                cubicTo(w * 0.70f, h * 0.34f, w * 0.72f, h * 0.47f, w * 0.64f, h * 0.58f)
                cubicTo(w * 0.82f, h * 0.55f, w * 0.84f, h * 0.80f, w * 0.61f, h * 0.88f)
                cubicTo(w * 0.37f, h * 0.96f, w * 0.19f, h * 0.81f, w * 0.28f, h * 0.62f)
                cubicTo(w * 0.34f, h * 0.50f, w * 0.46f, h * 0.43f, w * 0.52f, h * 0.16f)
                close()
            }
            drawPath(outer, LogoRed)

            val inner = Path().apply {
                moveTo(w * 0.51f, h * 0.48f)
                cubicTo(w * 0.62f, h * 0.60f, w * 0.62f, h * 0.69f, w * 0.57f, h * 0.75f)
                cubicTo(w * 0.50f, h * 0.82f, w * 0.40f, h * 0.77f, w * 0.41f, h * 0.68f)
                cubicTo(w * 0.42f, h * 0.61f, w * 0.49f, h * 0.57f, w * 0.51f, h * 0.48f)
                close()
            }
            drawPath(inner, Color(0xFFFFD6A0))
        }
    }
}
