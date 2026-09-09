package com.bbqtown.dickson.ops

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal val BrandInk = Color(0xFF122018)
internal val BrandInk2 = Color(0xFF203328)
internal val BrandCream = Color(0xFFF5F1E8)
internal val BrandSurface = Color(0xFFFFFCF7)
internal val BrandLine = Color(0xFFE2DDD1)
internal val BrandMuted = Color(0xFF6F746E)
internal val BrandGold = Color(0xFFC18A2C)
internal val BrandGreen = Color(0xFF27734A)
internal val BrandRed = Color(0xFFB5372F)

@Composable
internal fun BbqTownBrandLockup(compact: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        OfficialBbqTownLogo(
            Modifier
                .width(if (compact) 118.dp else 210.dp)
                .height(if (compact) 42.dp else 72.dp)
        )
        Spacer(Modifier.width(if (compact) 10.dp else 14.dp))
        Column {
            Text(
                "DICKSON OPERATIONS",
                color = Color.White,
                fontWeight = FontWeight.Black,
                fontSize = if (compact) 11.sp else 15.sp
            )
            Text(
                if (compact) "STORE OPS" else "BUFFET OPERATIONS",
                color = Color.White.copy(alpha = .62f),
                fontWeight = FontWeight.Bold,
                fontSize = if (compact) 7.sp else 9.sp,
                letterSpacing = 1.0.sp
            )
        }
    }
}

@Composable
internal fun BrandStatusDot(color: Color) {
    Box(Modifier.size(8.dp).background(color, CircleShape))
}
