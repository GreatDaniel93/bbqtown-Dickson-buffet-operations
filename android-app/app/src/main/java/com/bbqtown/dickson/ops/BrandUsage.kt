package com.bbqtown.dickson.ops

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun PremiumHero(title: String, subtitle: String) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = BrandInk,
        shape = RoundedCornerShape(22.dp)
    ) {
        Column(Modifier.padding(20.dp)) {
            BbqTownBrandLockup()
            Spacer(Modifier.height(18.dp))
            Text(title, color = Color.White, fontWeight = FontWeight.Black, fontSize = 26.sp)
            Text(subtitle, color = Color.White.copy(alpha = .58f), fontSize = 11.sp)
        }
    }
}

@Composable
internal fun PremiumSectionTitle(title: String, trailing: String? = null) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(title, color = BrandInk, fontWeight = FontWeight.Black, fontSize = 18.sp)
        if (trailing != null) Text(trailing, color = BrandMuted, fontSize = 10.sp)
    }
}
