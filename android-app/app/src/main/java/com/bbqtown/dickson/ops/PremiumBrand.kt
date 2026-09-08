package com.bbqtown.dickson.ops

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
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
        Surface(
            color = Color.White,
            shape = RoundedCornerShape(if (compact) 12.dp else 18.dp)
        ) {
            Image(
                painter = painterResource(R.drawable.ic_launcher),
                contentDescription = "BBQ Town logo",
                modifier = Modifier
                    .size(if (compact) 38.dp else 62.dp)
                    .clip(RoundedCornerShape(if (compact) 12.dp else 18.dp))
            )
        }
        Spacer(Modifier.width(if (compact) 10.dp else 14.dp))
        Column {
            Text(
                "BBQ TOWN",
                color = if (compact) Color.White else BrandGold,
                fontWeight = FontWeight.Black,
                fontSize = if (compact) 13.sp else 18.sp
            )
            Text(
                "DICKSON OPERATIONS",
                color = Color.White.copy(alpha = if (compact) .62f else .70f),
                fontWeight = FontWeight.Bold,
                fontSize = if (compact) 8.sp else 10.sp,
                letterSpacing = 1.1.sp
            )
        }
    }
}

@Composable
internal fun BrandStatusDot(color: Color) {
    Box(Modifier.size(8.dp).background(color, CircleShape))
}
